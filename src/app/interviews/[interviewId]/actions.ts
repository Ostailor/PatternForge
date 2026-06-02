"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { GameEventType } from "@/generated/prisma/enums";
import type { InterviewPhase, RubricCategory } from "@/generated/prisma/enums";
import { patterns } from "@/data/patterns";
import { requestAIInterviewerResponse } from "@/lib/ai/interviewer";
import { scoreInterview } from "@/lib/ai/scoreInterview";
import type {
  AIInterviewMessageInput,
  AIInterviewerInput,
} from "@/lib/ai/types";
import { checkAchievementsWithClient } from "@/lib/achievements/service";
import { createGameEventWithClient } from "@/lib/game/events";
import { calculateInterviewRewards } from "@/lib/interviews/rewards";
import { getPrisma } from "@/lib/prisma";
import {
  createAttemptForUserProfileWithClient,
  type CreateAttemptInput,
} from "@/lib/progress-db";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import type { Confidence, SolvedStatus } from "@/lib/types";

type RoundForScoring = {
  roundNumber: number;
  problemId: string;
  attemptId: string | null;
  aiReviewId?: string | null;
  selectedPatternId: string | null;
  correctPatternId: string;
  selectedPattern?: { name: string } | null;
  correctPattern?: { name: string } | null;
  problem?: {
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    estimatedMinutes: number;
    recognitionClues: string[];
    commonMistakes: string[];
    problemPatterns?: {
      isPrimary: boolean;
      pattern: { name: string };
    }[];
  };
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
};

type InterviewForFinalization = {
  id: string;
  userProfileId: string;
  interviewType: AIInterviewerInput["interviewType"];
  startedAt: Date;
  durationMinutes: number;
  messages: {
    role: "User" | "Interviewer" | "System";
    phase: InterviewPhase;
    content: string;
  }[];
  rounds: RoundForScoring[];
};

const RUBRIC_CATEGORIES: RubricCategory[] = [
  "Communication",
  "PatternRecognition",
  "ProblemSolving",
  "Implementation",
  "Testing",
  "Complexity",
  "TimeManagement",
];

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readPhase(formData: FormData): InterviewPhase | null {
  const phase = readString(formData, "phase");

  if (
    phase === "Setup" ||
    phase === "ClarifyingQuestions" ||
    phase === "PatternHypothesis" ||
    phase === "Approach" ||
    phase === "Implementation" ||
    phase === "Testing" ||
    phase === "Complexity"
  ) {
    return phase;
  }

  return null;
}

function readSolvedStatus(formData: FormData): SolvedStatus {
  const value = readString(formData, "solvedStatus");

  if (
    value === "Solved" ||
    value === "Partially Solved" ||
    value === "Not Solved"
  ) {
    return value;
  }

  return "Partially Solved";
}

function readConfidence(formData: FormData): Confidence {
  const value = Number.parseInt(readString(formData, "confidence"), 10);

  if (value >= 1 && value <= 5) {
    return value as Confidence;
  }

  return 3;
}

function readPositiveInt(
  formData: FormData,
  key: string,
  fallback: number,
): number {
  const value = Number.parseInt(readString(formData, key), 10);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function requireText(value: string, message: string): string {
  if (!value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function getPatternName(patternId: string | null): string {
  return patterns.find((pattern) => pattern.id === patternId)?.name ?? "Unknown";
}

function toAIMessageInput(message: {
  role: "User" | "Interviewer" | "System";
  phase: InterviewPhase;
  content: string;
}): AIInterviewMessageInput {
  return {
    role: message.role,
    phase: message.phase,
    content: message.content,
  };
}

function uniqueMessages(
  messages: {
    role: "User" | "Interviewer" | "System";
    phase: InterviewPhase;
    content: string;
  }[],
): AIInterviewMessageInput[] {
  const seen = new Set<string>();

  return messages.flatMap((message) => {
    const key = `${message.role}:${message.phase}:${message.content}`;

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [toAIMessageInput(message)];
  });
}

function getSecondaryPatternNames(round: RoundForScoring): string[] {
  return (
    round.problem?.problemPatterns
      ?.filter((problemPattern) => !problemPattern.isPrimary)
      .map((problemPattern) => problemPattern.pattern.name) ?? []
  );
}

function buildAttemptReflection({
  round,
  solvedStatus,
  confidence,
}: {
  round: RoundForScoring;
  solvedStatus: SolvedStatus;
  confidence: Confidence;
}): string {
  return [
    `Interview round ${round.roundNumber}`,
    `Self-reported status: ${solvedStatus}`,
    `Confidence: ${confidence}/5`,
    `Pattern hypothesis: ${
      round.selectedPattern?.name ??
      getPatternName(round.selectedPatternId) ??
      "Not selected"
    }`,
    `Pattern explanation:\n${round.patternExplanation ?? "Not recorded"}`,
    `Approach:\n${round.approachText ?? "Not recorded"}`,
    `Implementation:\n${round.codeText ?? "Not recorded"}`,
    `Testing:\n${round.testCasesText ?? "Not recorded"}`,
    `Complexity:\n${round.complexityText ?? "Not recorded"}`,
  ].join("\n\n");
}

function buildAIInterviewerInput({
  interview,
  round,
  phase,
  userInput,
}: {
  interview: {
    interviewType: AIInterviewerInput["interviewType"];
    messages: { role: "User" | "Interviewer" | "System"; phase: InterviewPhase; content: string }[];
  };
  round: RoundForScoring & {
    messages?: { role: "User" | "Interviewer" | "System"; phase: InterviewPhase; content: string }[];
  };
  phase: InterviewPhase;
  userInput: string;
}): AIInterviewerInput {
  return {
    interviewType: interview.interviewType,
    currentPhase: phase,
    problemTitle: round.problem?.title ?? "PatternForge problem",
    difficulty: round.problem?.difficulty ?? "Medium",
    recognitionClues: round.problem?.recognitionClues ?? [],
    commonMistakes: round.problem?.commonMistakes ?? [],
    correctPattern: round.correctPattern?.name ?? getPatternName(round.correctPatternId),
    secondaryPatterns: getSecondaryPatternNames(round),
    previousMessages: [
      ...uniqueMessages([
        ...interview.messages,
        ...(round.messages ?? []),
      ]),
    ],
    userInput,
    currentPhaseData: {
      selectedPatternName: round.selectedPattern?.name ?? null,
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
    },
    canRevealCorrectPattern:
      phase === "Feedback" ||
      Boolean(round.selectedPatternId && round.patternExplanation),
  };
}

async function finalizeInterview({
  tx,
  interview,
  completedAt,
}: {
  tx: Prisma.TransactionClient;
  interview: InterviewForFinalization;
  completedAt: Date;
}) {
  const score = await scoreInterview({
    interviewType: interview.interviewType,
    durationMinutes: interview.durationMinutes,
    startedAt: interview.startedAt,
    completedAt,
    rounds: interview.rounds.map((round) => ({
      roundNumber: round.roundNumber,
      problemTitle: round.problem?.title ?? "PatternForge problem",
      difficulty: round.problem?.difficulty ?? "Medium",
      estimatedMinutes: round.problem?.estimatedMinutes ?? interview.durationMinutes,
      recognitionClues: round.problem?.recognitionClues ?? [],
      commonMistakes: round.problem?.commonMistakes ?? [],
      selectedPatternName: round.selectedPattern?.name ?? null,
      correctPatternName:
        round.correctPattern?.name ?? getPatternName(round.correctPatternId),
      secondaryPatternNames: getSecondaryPatternNames(round),
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
    })),
    messages: interview.messages.map(toAIMessageInput),
  });
  const artifactRound =
    interview.rounds.find((round) => round.attemptId) ??
    interview.rounds[0] ??
    null;
  const reviewDueAt = new Date();
  const previousInterview = await tx.interviewSession.findFirst({
    where: {
      userProfileId: interview.userProfileId,
      status: "Completed",
      overallScore: {
        not: null,
      },
      id: {
        not: interview.id,
      },
    },
    select: {
      overallScore: true,
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
  });
  const rewards = calculateInterviewRewards({
    overallScore: score.overallScore,
    testingScore: score.Testing,
    complexityScore: score.Complexity,
    result: score.result,
    previousOverallScore: previousInterview?.overallScore ?? null,
    rounds: interview.rounds.map((round) => ({
      selectedPatternId: round.selectedPatternId,
      correctPatternId: round.correctPatternId,
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
    })),
  });

  await tx.interviewRubricScore.deleteMany({
    where: {
      interviewSessionId: interview.id,
    },
  });
  await tx.interviewFeedback.create({
    data: {
      interviewSessionId: interview.id,
      summary: score.summary,
      strengths: score.strengths,
      weaknesses: score.weaknesses,
      rubric: {
        scores: {
          Communication: score.Communication,
          PatternRecognition: score.PatternRecognition,
          ProblemSolving: score.ProblemSolving,
          Implementation: score.Implementation,
          Testing: score.Testing,
          Complexity: score.Complexity,
          TimeManagement: score.TimeManagement,
        },
        missedSignals: score.missedSignals,
        suggestedMistakes: score.suggestedMistakes,
        suggestedFlashcards: score.suggestedFlashcards,
      },
      followUpRecommendations: score.followUpRecommendations,
    },
  });
  await tx.interviewRubricScore.createMany({
    data: RUBRIC_CATEGORIES.map((category) => ({
      interviewSessionId: interview.id,
      category,
      score: score[category],
      notes: `${category} scored ${score[category]} from AI interview scoring.`,
    })),
  });
  if (artifactRound && score.suggestedFlashcards.length > 0) {
    await tx.flashcard.createMany({
      data: score.suggestedFlashcards.map((flashcard) => ({
        userProfileId: interview.userProfileId,
        sourceAttemptId: artifactRound.attemptId,
        patternId: artifactRound.correctPatternId,
        front: flashcard.front,
        back: flashcard.back,
        reviewDueAt,
      })),
    });
  }
  if (artifactRound?.attemptId && score.suggestedMistakes.length > 0) {
    await tx.mistake.createMany({
      data: score.suggestedMistakes.map((mistake) => ({
        userProfileId: interview.userProfileId,
        attemptId: artifactRound.attemptId as string,
        problemId: artifactRound.problemId,
        patternId: artifactRound.correctPatternId,
        mistakeType: mistake.mistakeType,
        description: mistake.description,
        correction: mistake.correction,
        reviewDueAt,
      })),
    });
  }
  for (const round of interview.rounds) {
    if (!round.attemptId || round.aiReviewId) {
      continue;
    }

    const aiReview = await tx.aIReview.create({
      data: {
        userProfileId: interview.userProfileId,
        attemptId: round.attemptId,
        problemId: round.problemId,
        patternId: round.correctPatternId,
        patternScore: Math.max(1, Math.round(score.PatternRecognition / 10)),
        implementationScore: Math.max(1, Math.round(score.Implementation / 10)),
        complexityScore: Math.max(1, Math.round(score.Complexity / 10)),
        explanationScore: Math.max(
          1,
          Math.round((score.Communication + score.ProblemSolving) / 20),
        ),
        feedbackSummary: score.summary,
        strengths: score.strengths,
        weaknesses: score.weaknesses,
        complexityFeedback:
          round.complexityText ??
          "Complexity was scored from the interview transcript.",
        suggestedNextStep:
          score.followUpRecommendations[0] ??
          "Repeat the interview and make the invariant explicit.",
      },
    });

    await tx.interviewRound.update({
      where: {
        interviewSessionId_roundNumber: {
          interviewSessionId: interview.id,
          roundNumber: round.roundNumber,
        },
      },
      data: {
        aiReviewId: aiReview.id,
      },
    });
  }
  await tx.interviewSession.update({
    where: {
      id: interview.id,
    },
    data: {
      status: "Completed",
      completedAt,
      overallScore: score.overallScore,
      communicationScore: score.Communication,
      patternRecognitionScore: score.PatternRecognition,
      problemSolvingScore: score.ProblemSolving,
      implementationScore: score.Implementation,
      testingScore: score.Testing,
      complexityScore: score.Complexity,
      timeManagementScore: score.TimeManagement,
      result: score.result,
    },
  });
  await tx.interviewMessage.create({
    data: {
      interviewSessionId: interview.id,
      role: "Interviewer",
      phase: "Feedback",
      content:
        "Interview complete. Feedback and rubric scores are saved below. I did not execute your code or verify test pass/fail status.",
    },
  });
  await createGameEventWithClient(
    tx,
    interview.userProfileId,
    GameEventType.InterviewCompleted,
    rewards.completedXp,
    "Interview completed",
    {
      interviewId: interview.id,
      interviewType: interview.interviewType,
      result: score.result,
      overallScore: score.overallScore,
      xpBreakdown: rewards.breakdown,
    },
  );
  if (rewards.strongResult) {
    await createGameEventWithClient(
      tx,
      interview.userProfileId,
      GameEventType.InterviewStrongResult,
      rewards.strongResultXp,
      "Strong interview result",
      {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        result: score.result,
        overallScore: score.overallScore,
      },
    );
  }
  if (rewards.improvedByAtLeast20) {
    await createGameEventWithClient(
      tx,
      interview.userProfileId,
      GameEventType.InterviewImprovement,
      rewards.improvementXp,
      "Interview score improved by 20+ points",
      {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        result: score.result,
        overallScore: score.overallScore,
        previousOverallScore: previousInterview?.overallScore ?? null,
        improvedBy: rewards.improvedBy,
      },
    );
  }
  await checkAchievementsWithClient(tx, interview.userProfileId);
}

export async function saveInterviewPhaseAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");
  const roundId = readString(formData, "roundId");
  const phase = readPhase(formData);

  if (!interviewId || !roundId || !phase) {
    redirect("/interviews");
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      const interview = await tx.interviewSession.findFirst({
        where: {
          id: interviewId,
          userProfileId: userProfile.id,
        },
        include: {
          rounds: {
            include: {
              selectedPattern: true,
              correctPattern: true,
              problem: {
                include: {
                  problemPatterns: {
                    include: {
                      pattern: true,
                    },
                  },
                },
              },
              messages: true,
            },
            orderBy: {
              roundNumber: "asc",
            },
          },
          messages: true,
        },
      });

      if (!interview || interview.status !== "Active") {
        throw new Error("Interview is not active.");
      }
      const activeInterview = interview;

      const round = interview.rounds.find(
        (interviewRound) => interviewRound.id === roundId,
      );

      if (!round || round.status === "Completed" || round.status === "Skipped") {
        throw new Error("Interview round is not active.");
      }
      const activeRound = round;
      const activePhase = phase;

      const userMessageData = {
        interviewSessionId: activeInterview.id,
        interviewRoundId: activeRound.id,
        role: "User" as const,
        phase: activePhase,
      };
      const interviewerMessageData = {
        interviewSessionId: activeInterview.id,
        interviewRoundId: activeRound.id,
        role: "Interviewer" as const,
        phase: activePhase,
      };

      async function getAIMessage(nextRoundState = activeRound, userInput = "") {
        const response = await requestAIInterviewerResponse(
          buildAIInterviewerInput({
            interview: activeInterview,
            round: nextRoundState,
            phase: activePhase,
            userInput,
          }),
        );

        return response.interviewerMessage;
      }

      if (activePhase === "Setup") {
        await tx.interviewMessage.create({
          data: {
            ...interviewerMessageData,
            content: await getAIMessage(activeRound, ""),
          },
        });
        await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { status: "Active" },
        });
        return;
      }

      if (activePhase === "ClarifyingQuestions") {
        const content = requireText(
          readString(formData, "clarifyingQuestions"),
          "Clarifying questions or assumptions are required.",
        );

        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(round, content),
            },
          ],
        });
        return;
      }

      if (activePhase === "PatternHypothesis") {
        const selectedPatternId = requireText(
          readString(formData, "selectedPatternId"),
          "Pattern selection is required.",
        );
        const patternExplanation = requireText(
          readString(formData, "patternExplanation"),
          "Pattern explanation is required.",
        );

        if (!patterns.some((pattern) => pattern.id === selectedPatternId)) {
          throw new Error("Selected pattern is not valid.");
        }

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: {
            selectedPatternId,
            patternExplanation,
          },
          include: {
            selectedPattern: true,
            correctPattern: true,
            problem: {
              include: {
                problemPatterns: {
                  include: {
                    pattern: true,
                  },
                },
              },
            },
            messages: true,
          },
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: `${getPatternName(selectedPatternId)}\n\n${patternExplanation}`,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, patternExplanation),
            },
          ],
        });
        return;
      }

      if (activePhase === "Approach") {
        const approachText = requireText(
          readString(formData, "approachText"),
          "Approach is required.",
        );

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { approachText },
          include: {
            selectedPattern: true,
            correctPattern: true,
            problem: {
              include: {
                problemPatterns: {
                  include: {
                    pattern: true,
                  },
                },
              },
            },
            messages: true,
          },
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: approachText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, approachText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Implementation") {
        const codeText = requireText(
          readString(formData, "codeText"),
          "Implementation notes or code are required.",
        );

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { codeText },
          include: {
            selectedPattern: true,
            correctPattern: true,
            problem: {
              include: {
                problemPatterns: {
                  include: {
                    pattern: true,
                  },
                },
              },
            },
            messages: true,
          },
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: codeText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, codeText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Testing") {
        const testCasesText = requireText(
          readString(formData, "testCasesText"),
          "Test cases and edge cases are required.",
        );

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { testCasesText },
          include: {
            selectedPattern: true,
            correctPattern: true,
            problem: {
              include: {
                problemPatterns: {
                  include: {
                    pattern: true,
                  },
                },
              },
            },
            messages: true,
          },
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: testCasesText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, testCasesText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Complexity") {
        const completedAt = new Date();
        const complexityText = requireText(
          readString(formData, "complexityText"),
          "Time and space complexity are required.",
        );
        const solvedStatus = readSolvedStatus(formData);
        const confidence = readConfidence(formData);
        const timeSpentMinutes = readPositiveInt(
          formData,
          "timeSpentMinutes",
          Math.max(
            1,
            Math.round(
              (completedAt.getTime() - activeRound.startedAt.getTime()) /
                (1000 * 60),
            ),
          ),
        );
        const nextRound = interview.rounds.find(
          (candidateRound) => candidateRound.roundNumber === activeRound.roundNumber + 1,
        );

        const completionUpdate = await tx.interviewRound.updateMany({
          where: {
            id: activeRound.id,
            status: "Active",
          },
          data: {
            complexityText,
            status: "Completed",
            completedAt,
          },
        });

        if (completionUpdate.count === 0) {
          throw new Error("Interview round was already completed.");
        }

        let updatedRound = await tx.interviewRound.findUniqueOrThrow({
          where: { id: activeRound.id },
          include: {
            selectedPattern: true,
            correctPattern: true,
            problem: {
              include: {
                problemPatterns: {
                  include: {
                    pattern: true,
                  },
                },
              },
            },
            messages: true,
          },
        });
        if (!updatedRound.attemptId) {
          if (!updatedRound.selectedPatternId) {
            throw new Error("Pattern hypothesis must be saved before feedback.");
          }

          const attemptInput: CreateAttemptInput = {
            problemId: updatedRound.problemId,
            selectedPatternId: updatedRound.selectedPatternId,
            solvedStatus,
            timeSpentMinutes,
            confidence,
            reflection: buildAttemptReflection({
              round: updatedRound,
              solvedStatus,
              confidence,
            }),
          };
          const attempt = await createAttemptForUserProfileWithClient(
            tx,
            userProfile.id,
            attemptInput,
          );

          updatedRound = await tx.interviewRound.update({
            where: { id: activeRound.id },
            data: {
              attemptId: attempt.id,
            },
            include: {
              selectedPattern: true,
              correctPattern: true,
              problem: {
                include: {
                  problemPatterns: {
                    include: {
                      pattern: true,
                    },
                  },
                },
              },
              messages: true,
            },
          });
        }
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: [
                complexityText,
                `Self-reported status: ${solvedStatus}`,
                `Time spent: ${timeSpentMinutes} min`,
                `Confidence: ${confidence}/5`,
              ].join("\n\n"),
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, complexityText),
            },
          ],
        });

        if (nextRound) {
          await tx.interviewRound.update({
            where: { id: nextRound.id },
            data: {
              status: "Active",
              startedAt: completedAt,
            },
          });
          return;
        }

        const refreshedInterview = await tx.interviewSession.findFirst({
          where: {
            id: interview.id,
            userProfileId: userProfile.id,
          },
          include: {
            rounds: {
              include: {
                selectedPattern: true,
                correctPattern: true,
                problem: {
                  include: {
                    problemPatterns: {
                      include: {
                        pattern: true,
                      },
                    },
                  },
                },
                messages: true,
              },
              orderBy: {
                roundNumber: "asc",
              },
            },
            messages: true,
          },
        });

        if (!refreshedInterview) {
          throw new Error("Interview could not be finalized.");
        }

        await finalizeInterview({
          tx,
          interview: refreshedInterview,
          completedAt,
        });
      }
    });
  } catch {
    redirect(`/interviews/${interviewId}?error=save`);
  }

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/summary`);
  redirect(`/interviews/${interviewId}`);
}

export async function abandonInterviewAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");

  if (!interviewId) {
    redirect("/interviews");
  }

  await getPrisma().$transaction(async (tx) => {
    const update = await tx.interviewSession.updateMany({
      where: {
        id: interviewId,
        userProfileId: userProfile.id,
        status: "Active",
      },
      data: {
        status: "Abandoned",
        completedAt: new Date(),
      },
    });

    if (update.count === 0) {
      return;
    }

    await tx.interviewRound.updateMany({
      where: {
        interviewSessionId: interviewId,
        status: {
          in: ["Active", "Pending"],
        },
      },
      data: {
        status: "Skipped",
        completedAt: new Date(),
      },
    });
  });

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${interviewId}`);
  redirect("/interviews");
}
