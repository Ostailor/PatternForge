"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { GameEventType } from "@/generated/prisma/enums";
import { checkAchievementsWithClient } from "@/lib/achievements/service";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { checkBattleQuestsAndAchievements } from "@/lib/battles/rewards";
import { scoreBattle } from "@/lib/battles/scoreBattle";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { createGameEventWithClient } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import {
  createAttemptForUserProfileWithClient,
  toAppAttempt,
} from "@/lib/progress-db";
import { updateQuestProgress } from "@/lib/quests/updateQuestProgress";
import type { Attempt, Confidence, SolvedStatus } from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type SaveBattleRoundAttemptInput = {
  battleId: string;
  roundId: string;
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  codeSubmissionId?: string;
};

export type SaveBattleRoundAttemptResult =
  | { status: "saved"; attempt: Attempt }
  | { status: "unauthenticated" }
  | { status: "forbidden"; message: string }
  | { status: "invalid"; message: string };

function validateBattleRoundAttemptInput(
  input: SaveBattleRoundAttemptInput,
): string | null {
  if (!input.battleId || !input.roundId || !input.problemId) {
    return "Battle round is required.";
  }

  if (!input.selectedPatternId) {
    return "Pattern selection is required.";
  }

  if (!Number.isInteger(input.timeSpentMinutes) || input.timeSpentMinutes < 1) {
    return "Time spent must be at least 1 minute.";
  }

  if (
    !Number.isInteger(input.confidence) ||
    input.confidence < 1 ||
    input.confidence > 5
  ) {
    return "Confidence must be between 1 and 5.";
  }

  if (!input.reflection.trim()) {
    return "Reflection is required.";
  }

  return null;
}

function getBattleRoundExecutionScore(round: {
  codeSubmissions: {
    codeRuns: {
      createdAt: Date;
      runType: string;
      status: string;
      testResults: {
        testCaseId: string | null;
        passed: boolean;
        testCase: {
          source: string;
        } | null;
      }[];
    }[];
  }[];
}) {
  const runs = round.codeSubmissions.flatMap((submission) => submission.codeRuns);
  const customTestRuns = runs
    .filter((run) => run.runType === "CustomTests")
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const latestCustomRun = customTestRuns.at(-1);
  const latestUserTestResults =
    latestCustomRun?.testResults.filter(
      (testResult) => testResult.testCase?.source === "User",
    ) ?? [];

  return {
    hasSuccessfulCustomTestRun: customTestRuns.some(
      (run) => run.status === "Succeeded",
    ),
    allUserCustomTestsPassed:
      latestUserTestResults.length > 0 &&
      latestUserTestResults.every((testResult) => testResult.passed),
    userCreatedTestCount: new Set(
      latestUserTestResults
        .map((testResult) => testResult.testCaseId)
        .filter((testCaseId): testCaseId is string => Boolean(testCaseId)),
    ).size,
  };
}

export async function saveBattleRoundAttemptAction(
  input: SaveBattleRoundAttemptInput,
): Promise<SaveBattleRoundAttemptResult> {
  if (!getFeatureFlag("bossBattles")) {
    return {
      status: "invalid",
      message: "Boss Battles are temporarily unavailable.",
    };
  }

  const validationError = validateBattleRoundAttemptInput(input);

  if (validationError) {
    return { status: "invalid", message: validationError };
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated" };
  }

  let result:
    | { status: "saved"; attempt: Attempt }
    | { status: "completed" }
    | { status: "forbidden"; message: string }
    | { status: "invalid"; message: string };

  try {
    result = await getPrisma().$transaction(async (tx) => {
      const round = await tx.battleRound.findFirst({
        where: {
          id: input.roundId,
          battleId: input.battleId,
        },
        include: {
          attempt: true,
          battle: {
            select: {
              userProfileId: true,
              status: true,
              battleType: true,
              targetPatternId: true,
            },
          },
        },
      });

      if (!round) {
        return {
          status: "invalid" as const,
          message: "Battle round was not found.",
        };
      }

      if (round.battle.userProfileId !== userProfile.id) {
        return {
          status: "forbidden" as const,
          message: "This battle is not available for the current user.",
        };
      }

      if (round.battle.status !== "Active") {
        return {
          status: "invalid" as const,
          message: "This battle is not active.",
        };
      }

      if (round.problemId !== input.problemId) {
        return {
          status: "invalid" as const,
          message: "Problem does not match the current battle round.",
        };
      }

      const attempt = round.attempt
        ? toAppAttempt(round.attempt)
        : await createAttemptForUserProfileWithClient(tx, userProfile.id, {
          problemId: input.problemId,
          selectedPatternId: input.selectedPatternId,
          solvedStatus: input.solvedStatus,
          timeSpentMinutes: input.timeSpentMinutes,
          confidence: input.confidence,
          reflection: input.reflection,
          codeSubmissionId: input.codeSubmissionId,
        });

      if (!round.attemptId || !round.completedAt) {
        if (input.codeSubmissionId?.trim()) {
          const codeSubmissionId = input.codeSubmissionId.trim();
          const linkedSubmission = await tx.codeSubmission.updateMany({
            where: {
              id: codeSubmissionId,
              userProfileId: userProfile.id,
              problemId: input.problemId,
              battleRoundId: round.id,
              attemptId: null,
            },
            data: {
              attemptId: attempt.id,
            },
          });

          if (linkedSubmission.count > 0) {
            await tx.debugInsight.updateMany({
              where: {
                userProfileId: userProfile.id,
                attemptId: null,
                codeRun: {
                  codeSubmissionId,
                },
              },
              data: {
                attemptId: attempt.id,
              },
            });
          }
        }

        await tx.battleRound.update({
          where: {
            id: round.id,
          },
          data: {
            attemptId: attempt.id,
            completedAt: new Date(),
          },
        });
      }

      const remainingRoundCount = await tx.battleRound.count({
        where: {
          battleId: input.battleId,
          completedAt: null,
        },
      });

      if (remainingRoundCount === 0) {
        const completedRounds = await tx.battleRound.findMany({
          where: {
            battleId: input.battleId,
          },
          include: {
            attempt: {
              select: {
                wasPatternCorrect: true,
                solvedStatus: true,
              },
            },
            codeSubmissions: {
              include: {
                codeRuns: {
                  orderBy: {
                    createdAt: "asc",
                  },
                  include: {
                    testResults: {
                      include: {
                        testCase: {
                          select: {
                            source: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        });

        if (completedRounds.every((completedRound) => completedRound.attempt)) {
          const score = scoreBattle(
            completedRounds.map((completedRound) => ({
              wasPatternCorrect:
                completedRound.attempt?.wasPatternCorrect ?? false,
              solvedStatus: completedRound.attempt?.solvedStatus ?? "NotSolved",
              ...getBattleRoundExecutionScore(completedRound),
            })),
          );

          const battleUpdate = await tx.battle.updateMany({
            where: {
              id: input.battleId,
              userProfileId: userProfile.id,
              status: "Active",
            },
            data: {
              status: "Completed",
              completedAt: new Date(),
              result: score.result,
              xpEarned: score.xpEarned,
            },
          });

          if (battleUpdate.count === 0) {
            return {
              status: "completed" as const,
            };
          }

          await createGameEventWithClient(
            tx,
            userProfile.id,
            GameEventType.BattleCompleted,
            score.xpEarned,
            "Boss battle completed",
            {
              battleId: input.battleId,
              result: score.result,
              recognitionAccuracy: score.recognitionAccuracy,
              correctRecognitionCount: score.correctRecognitionCount,
              solvedRoundCount: score.solvedRoundCount,
              partiallySolvedRoundCount: score.partiallySolvedRoundCount,
              completedOrPartialCount: score.completedOrPartialCount,
              executionBonusXp: score.executionBonusXp,
            },
          );
          await trackEvent({
            client: tx,
            eventName: AnalyticsEvents.BattleCompleted,
            userProfileId: userProfile.id,
            properties: {
              battleId: input.battleId,
              battleType: round.battle.battleType,
              targetPatternId: round.battle.targetPatternId ?? undefined,
              result: score.result,
              xpEarned: score.xpEarned,
              recognitionAccuracy: score.recognitionAccuracy,
              correctRecognitionCount: score.correctRecognitionCount,
              solvedRoundCount: score.solvedRoundCount,
              partiallySolvedRoundCount: score.partiallySolvedRoundCount,
              totalRounds: completedRounds.length,
            },
          });
          await updateQuestProgress(tx, userProfile.id, {
            eventType: "BattleCompleted",
            battleId: input.battleId,
          });

          await checkBattleQuestsAndAchievements(tx, {
            userProfileId: userProfile.id,
            battleId: input.battleId,
            battleType: round.battle.battleType,
            targetPatternId: round.battle.targetPatternId,
            score,
          });
          await checkAchievementsWithClient(tx, userProfile.id);

          return {
            status: "completed" as const,
          };
        }
      }

      return {
        status: "saved" as const,
        attempt,
      };
    });

  } catch (error) {
    return {
      status: "invalid",
      message:
        error instanceof Error ? error.message : "Battle round could not be saved.",
    };
  }

  revalidatePath("/");
  revalidatePath("/battles");
  revalidatePath(`/battles/${input.battleId}`);
  revalidatePath(`/battles/${input.battleId}/summary`);

  if (result.status === "completed") {
    redirect(`/battles/${input.battleId}/summary`);
  }

  return result;
}

export async function abandonBattleAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/battles?error=signin");
  }

  const battleId = formData.get("battleId");

  if (typeof battleId !== "string" || !battleId.trim()) {
    redirect("/battles");
  }

  await getPrisma().battle.updateMany({
    where: {
      id: battleId,
      userProfileId: userProfile.id,
      status: "Active",
    },
    data: {
      status: "Abandoned",
      completedAt: new Date(),
    },
  });

  revalidatePath("/battles");
  revalidatePath(`/battles/${battleId}`);
  redirect("/battles");
}
