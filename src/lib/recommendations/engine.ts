import "server-only";

import { Prisma } from "@/generated/prisma/client";
import type { RecommendationFeedbackType } from "@/generated/prisma/enums";
import { getCodeExecutionMetrics } from "@/lib/analytics/codeExecutionMetrics";
import { getPatternConfusions } from "@/lib/analytics/confusionMetrics";
import { getPatternMetrics } from "@/lib/analytics/patternMetrics";
import type {
  CodeExecutionMetrics,
  PatternMetric,
} from "@/lib/analytics/types";
import { getPrisma } from "@/lib/prisma";
import {
  applyRecommendationFeedbackPersonalization,
  deriveRecommendationFeedbackProfile,
  getDifficultyPreferenceForRecommendation,
  type RecommendationFeedbackProfile,
} from "@/lib/recommendations/personalization";
import {
  buildConfusionInsight,
  getTopPatternConfusions,
} from "@/lib/recommendations/patternConfusion";
import {
  buildWeaknessPatternInputs,
  calculatePatternWeaknessScores,
} from "@/lib/recommendations/weaknessScore";
import { getReviewStats } from "@/lib/review/queue";

import {
  buildActiveBattleRecommendation,
  buildActiveInterviewRecommendation,
  buildConfusionRecommendation,
  buildDailyForgeRecommendation,
  buildDebugDrillRecommendation,
  buildExplanationPracticeRecommendation,
  buildDueReviewRecommendation,
  buildFailedBattleRecommendation,
  buildFocusedInterviewRecommendation,
  buildImplementationPracticeRecommendation,
  buildLearningPlanStepRecommendation,
  buildMockInterviewRecommendation,
  buildReadyForBossRecommendation,
  buildSpeakingDrillRecommendation,
  buildSuccessfulSelfTestsRecommendation,
  buildTestingPracticeRecommendation,
  buildVoiceInterviewRecommendation,
  buildWeaknessRepairInterviewRecommendation,
  buildWeakPatternRecommendation,
} from "./insightGenerator";
import {
  getRecommendationDedupeKey,
  selectNextBestAction,
  sortRecommendations,
} from "./nextBestAction";
import {
  pickContrastProblem,
  pickPracticeProblemForPattern,
} from "./problemPicker";
import type { RecommendationCandidate, RecommendationType } from "./types";

const DUE_REVIEW_THRESHOLD = 3;
const CONFUSION_THRESHOLD = 2;
const DEFAULT_RECOMMENDATION_TTL_HOURS = 24;
const RECENT_INTERVIEW_DAYS = 21;
const RECENT_FAILED_BATTLE_DAYS = 14;
const ENOUGH_PRACTICE_ATTEMPTS = 3;
const LOW_TESTS_PER_RUN_THRESHOLD = 1.5;
const STRONG_RECOGNITION_THRESHOLD = 75;
const HIGH_MASTERY_THRESHOLD = 76;
const REPEATED_RUNTIME_ERROR_THRESHOLD = 2;
const LOW_COMMUNICATION_SCORE_THRESHOLD = 65;
const LOW_TECHNICAL_EXPLANATION_THRESHOLD = 65;
const VOICE_RECOMMENDATION_COOLDOWN_DAYS = 7;
const VOICE_AVOIDANCE_COOLDOWN_DAYS = 21;
const VOICE_AVOIDANCE_FEEDBACK_THRESHOLD = 2;

const voiceRecommendationTypes: RecommendationType[] = [
  "VoiceInterview",
  "SpeakingDrill",
  "ExplainPattern",
  "ComplexityNarration",
  "TestingNarration",
];

type RecommendationStatusUpdateResult =
  | { status: "updated"; recommendationId: string }
  | { status: "not_found" };

type RecommendationFeedbackCreateResult =
  | { status: "recorded"; recommendationId: string; feedbackId: string }
  | { status: "not_found" };

function normalizeUserProfileId(userProfileId: string): string {
  return userProfileId.trim();
}

function getDefaultExpiresAt(now = new Date()): Date {
  return new Date(
    now.getTime() + DEFAULT_RECOMMENDATION_TTL_HOURS * 60 * 60 * 1000,
  );
}

function withPersistenceMetadata(
  recommendation: RecommendationCandidate,
): Prisma.InputJsonValue {
  return {
    ...recommendation.metadata,
    evidence: recommendation.evidence,
    dedupeKey: getRecommendationDedupeKey(recommendation),
  } as Prisma.InputJsonValue;
}

function getPatternName(
  patternMetrics: PatternMetric[],
  patternId: string | undefined,
): string | undefined {
  if (!patternId) {
    return undefined;
  }

  return patternMetrics.find((metric) => metric.patternId === patternId)?.patternName;
}

async function getLatestCodeProblemForPattern({
  userProfileId,
  patternId,
}: {
  userProfileId: string;
  patternId?: string;
}): Promise<string | undefined> {
  if (!patternId) {
    const latestSubmission = await getPrisma().codeSubmission.findFirst({
      where: {
        userProfileId,
      },
      select: {
        problemId: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return latestSubmission?.problemId;
  }

  const latestSubmission = await getPrisma().codeSubmission.findFirst({
    where: {
      userProfileId,
      problem: {
        problemPatterns: {
          some: {
            patternId,
          },
        },
      },
    },
    select: {
      problemId: true,
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return latestSubmission?.problemId;
}

function getFallbackPattern(patternMetrics: PatternMetric[]): PatternMetric | null {
  return (
    patternMetrics
      .slice()
      .sort(
        (a, b) =>
          b.attemptsCount - a.attemptsCount ||
          a.masteryScore - b.masteryScore ||
          a.patternName.localeCompare(b.patternName),
      )[0] ?? null
  );
}

async function getActiveBattleRecommendation(
  userProfileId: string,
): Promise<RecommendationCandidate | null> {
  const activeBattle = await getPrisma().battle.findFirst({
    where: {
      userProfileId,
      status: "Active",
    },
    select: {
      id: true,
      title: true,
      battleType: true,
      targetPatternId: true,
    },
    orderBy: { startedAt: "desc" },
  });

  return activeBattle
    ? buildActiveBattleRecommendation({
        battleId: activeBattle.id,
        title: activeBattle.title,
        battleType: activeBattle.battleType,
        targetPatternId: activeBattle.targetPatternId,
      })
    : null;
}

async function getActiveInterviewRecommendation(
  userProfileId: string,
): Promise<RecommendationCandidate | null> {
  const activeInterview = await getPrisma().interviewSession.findFirst({
    where: {
      userProfileId,
      status: "Active",
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: { startedAt: "desc" },
  });

  return activeInterview
    ? buildActiveInterviewRecommendation({
        interviewId: activeInterview.id,
        title: activeInterview.title,
      })
    : null;
}

async function getHighWeaknessRecommendation({
  userProfileId,
  patternMetrics,
  feedbackProfile,
}: {
  userProfileId: string;
  patternMetrics: PatternMetric[];
  feedbackProfile: RecommendationFeedbackProfile;
}): Promise<RecommendationCandidate | null> {
  const confusions = await getPatternConfusions(userProfileId);
  const weaknessScores = calculatePatternWeaknessScores(
    buildWeaknessPatternInputs(patternMetrics, confusions),
  );
  const highWeakness = weaknessScores.find(
    (weakness) => weakness.severity === "High",
  );

  if (!highWeakness) {
    return null;
  }

  const pickedProblem = await pickPracticeProblemForPattern(
    userProfileId,
    highWeakness.patternId,
    {
      difficultyPreference: getDifficultyPreferenceForRecommendation(
        feedbackProfile,
        highWeakness.recommendedActionType,
        highWeakness.patternId,
      ),
    },
  );

  return buildWeakPatternRecommendation({
    weakness: highWeakness,
    patternName: getPatternName(patternMetrics, highWeakness.patternId) ?? "pattern",
    problemId: pickedProblem?.problemId,
  });
}

async function getConfusionRecommendation(
  userProfileId: string,
  feedbackProfile: RecommendationFeedbackProfile,
): Promise<RecommendationCandidate | null> {
  const confusion = (await getTopPatternConfusions(userProfileId)).find(
    (item) => item.count >= CONFUSION_THRESHOLD,
  );

  if (!confusion) {
    return null;
  }

  const pickedProblem = await pickContrastProblem({
    userProfileId,
    correctPatternId: confusion.correctPatternId,
    difficultyPreference: getDifficultyPreferenceForRecommendation(
      feedbackProfile,
      "ContrastDrill",
      confusion.correctPatternId,
    ),
  });

  return buildConfusionRecommendation(
    buildConfusionInsight(confusion),
    pickedProblem?.problemId,
  );
}

async function getFailedBattleRecommendation(
  userProfileId: string,
  feedbackProfile: RecommendationFeedbackProfile,
): Promise<RecommendationCandidate | null> {
  const battle = await getPrisma().battle.findFirst({
    where: {
      userProfileId,
      status: "Completed",
      result: { in: ["Defeat", "PartialVictory"] },
    },
    select: {
      id: true,
      title: true,
      result: true,
      targetPatternId: true,
      targetPattern: {
        select: { name: true },
      },
      rounds: {
        select: {
          expectedPatternId: true,
          expectedPattern: {
            select: { name: true },
          },
        },
        orderBy: { roundNumber: "asc" },
        take: 1,
      },
    },
    orderBy: { completedAt: "desc" },
  });

  if (
    !battle ||
    (battle.result !== "Defeat" && battle.result !== "PartialVictory")
  ) {
    return null;
  }

  const targetPatternId =
    battle.targetPatternId ?? battle.rounds[0]?.expectedPatternId;
  const patternName =
    battle.targetPattern?.name ?? battle.rounds[0]?.expectedPattern.name;
  const recommendationType = battle.result === "Defeat" ? "ReviewGauntlet" : "FocusPattern";
  const pickedProblem = targetPatternId
    ? await pickPracticeProblemForPattern(userProfileId, targetPatternId, {
        difficultyPreference: getDifficultyPreferenceForRecommendation(
          feedbackProfile,
          recommendationType,
          targetPatternId,
        ),
      })
    : null;

  return buildFailedBattleRecommendation({
    battleId: battle.id,
    battleTitle: battle.title,
    result: battle.result,
    targetPatternId,
    patternName,
    problemId: pickedProblem?.problemId,
  });
}

async function getLearningPlanStepRecommendation(
  userProfileId: string,
  now = new Date(),
): Promise<RecommendationCandidate | null> {
  const step = await getPrisma().learningPlanStep.findFirst({
    where: {
      status: { in: ["Pending", "Active"] },
      dueDate: { lte: now },
      learningPlan: {
        userProfileId,
        status: "Active",
      },
    },
    select: {
      id: true,
      learningPlanId: true,
      title: true,
      stepType: true,
      dueDate: true,
      targetPatternId: true,
      problemId: true,
    },
    orderBy: [{ dueDate: "asc" }, { dayIndex: "asc" }],
  });

  return step
    ? buildLearningPlanStepRecommendation({
        stepId: step.id,
        learningPlanId: step.learningPlanId,
        title: step.title,
        stepType: step.stepType,
        dueDate: step.dueDate,
        targetPatternId: step.targetPatternId,
        problemId: step.problemId,
      })
    : null;
}

function getReadyForBossRecommendation(
  patternMetrics: PatternMetric[],
): RecommendationCandidate | null {
  const readyPattern = patternMetrics
    .filter(
      (metric) =>
        metric.attemptsCount > 0 &&
        metric.masteryScore >= 76 &&
        (metric.retentionScore ?? 0) >= 75,
    )
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        (b.retentionScore ?? 0) - (a.retentionScore ?? 0) ||
        a.patternName.localeCompare(b.patternName),
    )[0];

  return readyPattern
    ? buildReadyForBossRecommendation({
        patternId: readyPattern.patternId,
        patternName: readyPattern.patternName,
      })
    : null;
}

async function getExplanationPracticeRecommendation(
  userProfileId: string,
): Promise<RecommendationCandidate | null> {
  const submission = await getPrisma().codeSubmission.findFirst({
    where: {
      userProfileId,
      attemptId: {
        not: null,
      },
      codeRuns: {
        some: {
          testResults: {
            some: {},
            every: {
              passed: true,
            },
          },
        },
      },
      attempt: {
        aiReviews: {
          some: {
            explanationScore: {
              lt: 70,
            },
          },
        },
      },
    },
    select: {
      problemId: true,
      attempt: {
        select: {
          aiReviews: {
            select: {
              patternId: true,
              explanationScore: true,
              pattern: {
                select: {
                  name: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const review = submission?.attempt?.aiReviews[0];

  if (!submission || !review) {
    return null;
  }

  return buildExplanationPracticeRecommendation({
    patternId: review.patternId,
    patternName: review.pattern.name,
    problemId: submission.problemId,
    explanationScore: review.explanationScore,
  });
}

async function getCodeExecutionRecommendations({
  userProfileId,
  patternMetrics,
  codeExecution,
}: {
  userProfileId: string;
  patternMetrics: PatternMetric[];
  codeExecution: CodeExecutionMetrics;
}): Promise<RecommendationCandidate[]> {
  if (
    codeExecution.totalCodeSubmissions === 0 &&
    codeExecution.totalCodeRuns === 0
  ) {
    return [];
  }

  const recommendations: Array<RecommendationCandidate | null> = [];
  const repeatedRuntimeErrorPattern =
    codeExecution.patternsWithRuntimeErrors.find(
      (pattern) => pattern.count >= REPEATED_RUNTIME_ERROR_THRESHOLD,
    ) ?? null;

  if (repeatedRuntimeErrorPattern) {
    recommendations.push(
      buildDebugDrillRecommendation({
        patternId: repeatedRuntimeErrorPattern.patternId,
        patternName: repeatedRuntimeErrorPattern.patternName,
        problemId: await getLatestCodeProblemForPattern({
          userProfileId,
          patternId: repeatedRuntimeErrorPattern.patternId,
        }),
        runtimeErrorCount: repeatedRuntimeErrorPattern.count,
      }),
    );
  }

  if (
    codeExecution.totalCodeRuns >= 2 &&
    codeExecution.averageTestsPerRun < LOW_TESTS_PER_RUN_THRESHOLD
  ) {
    recommendations.push(
      buildTestingPracticeRecommendation({
        problemId: await getLatestCodeProblemForPattern({ userProfileId }),
        averageTestsPerRun: codeExecution.averageTestsPerRun,
        totalCodeRuns: codeExecution.totalCodeRuns,
      }),
    );
  }

  const implementationPattern = codeExecution.patternsWithRepeatedFailedTests
    .map((pattern) => ({
      executionSignal: pattern,
      masterySignal: patternMetrics.find(
        (metric) => metric.patternId === pattern.patternId,
      ),
    }))
    .find(
      ({ masterySignal }) =>
        (masterySignal?.recognitionAccuracy ?? 0) >= STRONG_RECOGNITION_THRESHOLD,
    );

  if (implementationPattern) {
    recommendations.push(
      buildImplementationPracticeRecommendation({
        patternId: implementationPattern.executionSignal.patternId,
        patternName: implementationPattern.executionSignal.patternName,
        problemId: await getLatestCodeProblemForPattern({
          userProfileId,
          patternId: implementationPattern.executionSignal.patternId,
        }),
        failedRunCount: implementationPattern.executionSignal.count,
        recognitionAccuracy:
          implementationPattern.masterySignal?.recognitionAccuracy ?? 0,
      }),
    );
  }

  recommendations.push(await getExplanationPracticeRecommendation(userProfileId));

  const highMasteryPattern = patternMetrics
    .filter(
      (metric) =>
        metric.masteryScore >= HIGH_MASTERY_THRESHOLD &&
        metric.recognitionAccuracy >= STRONG_RECOGNITION_THRESHOLD,
    )
    .sort(
      (left, right) =>
        right.masteryScore - left.masteryScore ||
        right.recognitionAccuracy - left.recognitionAccuracy ||
        left.patternName.localeCompare(right.patternName),
    )[0];

  if (
    highMasteryPattern &&
    codeExecution.problemsWithSuccessfulSelfTests > 0
  ) {
    recommendations.push(
      buildSuccessfulSelfTestsRecommendation({
        patternId: highMasteryPattern.patternId,
        patternName: highMasteryPattern.patternName,
        successfulProblemCount: codeExecution.problemsWithSuccessfulSelfTests,
      }),
    );
  }

  return recommendations.filter(
    (recommendation): recommendation is RecommendationCandidate =>
      recommendation !== null,
  );
}

function average(values: number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length;
}

function getWeakPracticePattern(patternMetrics: PatternMetric[]): PatternMetric | null {
  return (
    patternMetrics
      .filter(
        (metric) =>
          metric.attemptsCount >= ENOUGH_PRACTICE_ATTEMPTS &&
          (metric.masteryScore < 62 ||
            metric.solveRate < 60 ||
            metric.recognitionAccuracy < 70),
      )
      .sort(
        (a, b) =>
          a.masteryScore - b.masteryScore ||
          a.solveRate - b.solveRate ||
          a.patternName.localeCompare(b.patternName),
      )[0] ?? null
  );
}

function getDecentMasteryPatternCount(patternMetrics: PatternMetric[]): number {
  return patternMetrics.filter(
    (metric) =>
      metric.attemptsCount > 0 &&
      metric.masteryScore >= 55 &&
      metric.recognitionAccuracy >= 55,
  ).length;
}

function hasHighReadiness(patternMetrics: PatternMetric[]): boolean {
  const practicedPatterns = patternMetrics.filter((metric) => metric.attemptsCount > 0);

  return (
    practicedPatterns.length >= 3 &&
    (average(practicedPatterns.map((metric) => metric.masteryScore)) ?? 0) >= 68 &&
    (average(practicedPatterns.map((metric) => metric.recognitionAccuracy)) ?? 0) >=
      68
  );
}

function hasStrongCodingSignal({
  patternMetrics,
  codeExecution,
}: {
  patternMetrics: PatternMetric[];
  codeExecution: CodeExecutionMetrics;
}): boolean {
  const runtimeStability = Math.max(
    0,
    100 - codeExecution.runtimeErrorRate - codeExecution.timeoutRate,
  );
  const practicedPatterns = patternMetrics.filter((metric) => metric.attemptsCount > 0);
  const averageMastery =
    average(practicedPatterns.map((metric) => metric.masteryScore)) ?? 0;

  return (
    (codeExecution.totalCodeRuns >= 2 &&
      codeExecution.customTestPassRate >= 75 &&
      runtimeStability >= 70) ||
    (practicedPatterns.length >= 3 && averageMastery >= 70)
  );
}

function averageVoiceFeedbackScore(feedback: {
  clarityScore: number;
  structureScore: number;
  concisenessScore: number;
  confidenceScore: number;
  technicalExplanationScore: number;
}): number {
  return Math.round(
    (feedback.clarityScore +
      feedback.structureScore +
      feedback.concisenessScore +
      feedback.confidenceScore +
      feedback.technicalExplanationScore) /
      5,
  );
}

async function shouldThrottleVoiceRecommendations(
  userProfileId: string,
  now = new Date(),
): Promise<boolean> {
  const avoidanceCutoff = new Date(
    now.getTime() - 60 * 24 * 60 * 60 * 1000,
  );
  const [latestVoiceRecommendation, notRelevantCount] = await Promise.all([
    getPrisma().recommendation.findFirst({
      where: {
        userProfileId,
        recommendationType: { in: voiceRecommendationTypes },
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    getPrisma().recommendationFeedback.count({
      where: {
        userProfileId,
        feedbackType: "NotRelevant",
        createdAt: { gte: avoidanceCutoff },
        recommendation: {
          recommendationType: { in: voiceRecommendationTypes },
        },
      },
    }),
  ]);

  if (!latestVoiceRecommendation) {
    return false;
  }

  const cooldownDays =
    notRelevantCount >= VOICE_AVOIDANCE_FEEDBACK_THRESHOLD
      ? VOICE_AVOIDANCE_COOLDOWN_DAYS
      : VOICE_RECOMMENDATION_COOLDOWN_DAYS;
  const cooldownCutoff = new Date(
    now.getTime() - cooldownDays * 24 * 60 * 60 * 1000,
  );

  return latestVoiceRecommendation.createdAt >= cooldownCutoff;
}

async function getCommunicationRecommendation({
  userProfileId,
  patternMetrics,
  codeExecution,
}: {
  userProfileId: string;
  patternMetrics: PatternMetric[];
  codeExecution: CodeExecutionMetrics;
}): Promise<RecommendationCandidate | null> {
  if (await shouldThrottleVoiceRecommendations(userProfileId)) {
    return null;
  }

  const [
    completedVoiceInterviewCount,
    latestVoiceFeedback,
    missingInvariantInsight,
    missingInvariantCount,
    weakComplexityCount,
    weakTestingCount,
    lowInterviewCommunication,
  ] = await Promise.all([
    getPrisma().voiceSession.count({
      where: {
        userProfileId,
        status: "Completed",
        turns: {
          some: {
            speaker: "User",
          },
        },
        interviewSession: {
          userProfileId,
          status: "Completed",
        },
      },
    }),
    getPrisma().voiceFeedback.findFirst({
      where: {
        userProfileId,
        interviewSession: {
          userProfileId,
          status: "Completed",
        },
      },
      select: {
        id: true,
        clarityScore: true,
        structureScore: true,
        concisenessScore: true,
        confidenceScore: true,
        technicalExplanationScore: true,
        weaknesses: true,
        interviewSession: {
          select: {
            id: true,
          },
        },
        communicationInsights: {
          select: {
            insightType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().communicationInsight.findFirst({
      where: {
        userProfileId,
        insightType: "MissingInvariant",
        voiceFeedbackId: { not: null },
      },
      select: {
        id: true,
        summary: true,
        interviewSession: {
          select: {
            rounds: {
              select: {
                correctPatternId: true,
                problemId: true,
                correctPattern: {
                  select: {
                    name: true,
                  },
                },
              },
              orderBy: { roundNumber: "asc" },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().communicationInsight.count({
      where: {
        userProfileId,
        insightType: "MissingInvariant",
        voiceFeedbackId: { not: null },
      },
    }),
    getPrisma().communicationInsight.count({
      where: {
        userProfileId,
        insightType: "WeakComplexityExplanation",
        voiceFeedbackId: { not: null },
      },
    }),
    getPrisma().communicationInsight.count({
      where: {
        userProfileId,
        insightType: "WeakTestingExplanation",
        voiceFeedbackId: { not: null },
      },
    }),
    getPrisma().interviewSession.findFirst({
      where: {
        userProfileId,
        status: "Completed",
        communicationScore: { lte: LOW_COMMUNICATION_SCORE_THRESHOLD },
      },
      select: {
        id: true,
        communicationScore: true,
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);
  const strongCodingSignal = hasStrongCodingSignal({
    patternMetrics,
    codeExecution,
  });
  const latestCommunicationScore = latestVoiceFeedback
    ? averageVoiceFeedbackScore(latestVoiceFeedback)
    : lowInterviewCommunication?.communicationScore ?? null;
  const missingInvariantRound =
    missingInvariantInsight?.interviewSession?.rounds[0] ?? null;
  const hasWeakTestingExplanation =
    weakTestingCount > 0 ||
    latestVoiceFeedback?.communicationInsights.some(
      (insight) => insight.insightType === "WeakTestingExplanation",
    ) ||
    latestVoiceFeedback?.weaknesses.some((weakness) =>
      weakness.toLowerCase().includes("test"),
    );
  const hasWeakComplexityExplanation =
    weakComplexityCount > 0 ||
    (latestVoiceFeedback?.technicalExplanationScore ?? 100) <=
      LOW_TECHNICAL_EXPLANATION_THRESHOLD;

  if (missingInvariantCount >= 2) {
    return buildSpeakingDrillRecommendation({
      recommendationType: "ExplainPattern",
      title: missingInvariantRound?.correctPattern.name
        ? `Explain ${missingInvariantRound.correctPattern.name} invariants`
        : "Explain pattern invariants",
      reason:
        "Spoken feedback repeatedly flagged missing invariants. Practice explaining the maintained state before implementation details.",
      patternId: missingInvariantRound?.correctPatternId,
      problemId: missingInvariantRound?.problemId,
      metadata: {
        reasonCode: "repeated_spoken_missing_invariant",
        missingInvariantCount,
        communicationInsightId: missingInvariantInsight?.id,
      },
      evidence: [
        `${missingInvariantCount} MissingInvariant communication insight${missingInvariantCount === 1 ? "" : "s"}`,
        missingInvariantInsight?.summary ?? "Latest spoken answer missed invariant reasoning",
      ],
    });
  }

  if (hasWeakComplexityExplanation) {
    return buildSpeakingDrillRecommendation({
      recommendationType: "ComplexityNarration",
      title: "Practice complexity narration",
      reason:
        "Voice feedback shows weak complexity explanation. Practice tying Big-O terms to loops, data structures, and maintained state.",
      metadata: {
        reasonCode: "weak_spoken_complexity_explanation",
        weakComplexityCount,
        voiceFeedbackId: latestVoiceFeedback?.id,
        technicalExplanationScore:
          latestVoiceFeedback?.technicalExplanationScore ?? null,
      },
      evidence: [
        latestVoiceFeedback
          ? `Technical explanation score: ${latestVoiceFeedback.technicalExplanationScore}%`
          : `${weakComplexityCount} weak complexity insight${weakComplexityCount === 1 ? "" : "s"}`,
      ],
    });
  }

  if (hasWeakTestingExplanation) {
    return buildSpeakingDrillRecommendation({
      recommendationType: "TestingNarration",
      title: "Practice testing narration",
      reason:
        "Voice feedback flagged weak testing explanation. Narrate normal cases, edge cases, and verification before relying on code.",
      metadata: {
        reasonCode: "weak_spoken_testing_explanation",
        weakTestingCount,
        voiceFeedbackId: latestVoiceFeedback?.id,
      },
      evidence: [
        weakTestingCount > 0
          ? `${weakTestingCount} weak testing explanation insight${weakTestingCount === 1 ? "" : "s"}`
          : "Latest voice feedback mentioned testing explanation weakness",
      ],
    });
  }

  if (
    strongCodingSignal &&
    latestCommunicationScore !== null &&
    latestCommunicationScore <= LOW_COMMUNICATION_SCORE_THRESHOLD
  ) {
    return buildSpeakingDrillRecommendation({
      recommendationType: "SpeakingDrill",
      title: "Practice speaking through a solved approach",
      reason:
        "Your coding signal is stronger than your communication signal. Use a short speaking drill to practice making reasoning easier to follow.",
      metadata: {
        reasonCode: "strong_coding_weak_communication",
        communicationScore: latestCommunicationScore,
        customTestPassRate: codeExecution.customTestPassRate,
        totalCodeRuns: codeExecution.totalCodeRuns,
      },
      evidence: [
        `Communication score: ${latestCommunicationScore}%`,
        `Custom test pass rate: ${codeExecution.customTestPassRate}%`,
      ],
    });
  }

  if (
    completedVoiceInterviewCount === 0 &&
    (hasHighReadiness(patternMetrics) || strongCodingSignal)
  ) {
    return buildVoiceInterviewRecommendation({
      title: "Try a voice mock interview",
      reason:
        "Your readiness signals are decent, but there is no completed voice interview yet. Add one spoken mock to baseline communication without replacing technical practice.",
      metadata: {
        reasonCode: "decent_readiness_no_voice_interviews",
        completedVoiceInterviewCount,
      },
      evidence: [
        "No completed voice interviews",
        strongCodingSignal ? "Strong coding signal" : "Decent readiness signal",
      ],
    });
  }

  return null;
}

async function getInterviewReadinessRecommendation({
  userProfileId,
  patternMetrics,
  dueReviewCount,
}: {
  userProfileId: string;
  patternMetrics: PatternMetric[];
  dueReviewCount: number;
}): Promise<RecommendationCandidate | null> {
  const now = new Date();
  const recentInterviewCutoff = new Date(
    now.getTime() - RECENT_INTERVIEW_DAYS * 24 * 60 * 60 * 1000,
  );
  const recentFailedBattleCutoff = new Date(
    now.getTime() - RECENT_FAILED_BATTLE_DAYS * 24 * 60 * 60 * 1000,
  );
  const [
    completedInterviewCount,
    latestInterview,
    lowInterviewScore,
    recentFailedBossBattle,
  ] = await Promise.all([
    getPrisma().interviewSession.count({
      where: {
        userProfileId,
        status: "Completed",
      },
    }),
    getPrisma().interviewSession.findFirst({
      where: {
        userProfileId,
        status: "Completed",
      },
      select: {
        completedAt: true,
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    }),
    getPrisma().interviewSession.findFirst({
      where: {
        userProfileId,
        status: "Completed",
        OR: [
          { communicationScore: { lte: 65 } },
          { problemSolvingScore: { lte: 65 } },
          { overallScore: { lte: 65 } },
        ],
      },
      select: {
        id: true,
        communicationScore: true,
        problemSolvingScore: true,
        overallScore: true,
      },
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    }),
    getPrisma().battle.findFirst({
      where: {
        userProfileId,
        status: "Completed",
        battleType: "PatternBoss",
        result: { in: ["Defeat", "PartialVictory"] },
        completedAt: { gte: recentFailedBattleCutoff },
      },
      select: {
        id: true,
        title: true,
        result: true,
        targetPatternId: true,
        targetPattern: {
          select: { name: true },
        },
        rounds: {
          select: {
            expectedPatternId: true,
            expectedPattern: {
              select: { name: true },
            },
          },
          orderBy: { roundNumber: "asc" },
          take: 1,
        },
      },
      orderBy: { completedAt: "desc" },
    }),
  ]);
  const weakPracticePattern = getWeakPracticePattern(patternMetrics);
  const decentPatternCount = getDecentMasteryPatternCount(patternMetrics);
  const latestCompletedAt = latestInterview?.completedAt ?? null;
  const hasRecentInterview =
    latestCompletedAt !== null && latestCompletedAt >= recentInterviewCutoff;

  if (completedInterviewCount === 0 && hasHighReadiness(patternMetrics)) {
    return buildMockInterviewRecommendation({
      title: "Start single problem mock interview",
      reason:
        "Your readiness signals are strong, but no mock interviews are completed yet. Add a timed interview baseline.",
      metadata: {
        interviewType: "SingleProblem",
        reasonCode: "high_readiness_no_interviews",
      },
      evidence: [
        "High practice readiness",
        "No completed interviews",
        dueReviewCount > 0 ? `${dueReviewCount} review items remain due` : "No review crowd-out",
      ],
    });
  }

  if (recentFailedBossBattle) {
    const targetPatternId =
      recentFailedBossBattle.targetPatternId ??
      recentFailedBossBattle.rounds[0]?.expectedPatternId;
    const patternName =
      recentFailedBossBattle.targetPattern?.name ??
      recentFailedBossBattle.rounds[0]?.expectedPattern.name;

    return buildWeaknessRepairInterviewRecommendation({
      patternId: targetPatternId,
      patternName,
      reason:
        "A recent boss battle exposed pressure-test gaps. Use a weakness repair interview to practice explanation, pattern selection, and recovery.",
      metadata: {
        interviewType: "WeaknessRepair",
        reasonCode: "recent_failed_boss_battle",
        battleId: recentFailedBossBattle.id,
        battleResult: recentFailedBossBattle.result,
      },
      evidence: [
        `Recent boss battle result: ${recentFailedBossBattle.result}`,
        recentFailedBossBattle.title,
      ],
    });
  }

  if (lowInterviewScore) {
    return buildMockInterviewRecommendation({
      title: "Start explanation-focused mock interview",
      reason:
        "Recent interview scoring shows communication or explanation gaps. Run another mock and focus on talking through assumptions, invariants, and tradeoffs.",
      metadata: {
        interviewType: "SingleProblem",
        focus: "explanation",
        reasonCode: "low_communication_or_interview_score",
        interviewId: lowInterviewScore.id,
      },
      evidence: [
        `Communication score: ${lowInterviewScore.communicationScore ?? "not scored"}`,
        `Problem solving score: ${lowInterviewScore.problemSolvingScore ?? "not scored"}`,
        `Overall score: ${lowInterviewScore.overallScore ?? "not scored"}`,
      ],
    });
  }

  if (weakPracticePattern) {
    return buildFocusedInterviewRecommendation({
      patternId: weakPracticePattern.patternId,
      patternName: weakPracticePattern.patternName,
      reason:
        "You have enough attempts to identify a weak pattern. A focused interview will test whether you can explain and apply it under time pressure.",
      metadata: {
        interviewType: "FocusedPattern",
        reasonCode: "weak_pattern_enough_attempts",
        masteryScore: weakPracticePattern.masteryScore,
        attemptsCount: weakPracticePattern.attemptsCount,
      },
      evidence: [
        `${weakPracticePattern.attemptsCount} attempts on ${weakPracticePattern.patternName}`,
        `Mastery ${weakPracticePattern.masteryScore}%`,
        `Solve rate ${weakPracticePattern.solveRate}%`,
      ],
    });
  }

  if (decentPatternCount >= 2) {
    return buildMockInterviewRecommendation({
      title: "Start mixed mock interview",
      reason:
        "Multiple patterns have decent mastery. A mixed interview checks transfer instead of isolated pattern recall.",
      metadata: {
        interviewType: "MixedInterview",
        reasonCode: "multiple_decent_patterns",
        decentPatternCount,
      },
      evidence: [`${decentPatternCount} patterns have decent mastery`],
    });
  }

  if (completedInterviewCount > 0 && !hasRecentInterview) {
    return buildMockInterviewRecommendation({
      title: "Return to Interview Mode",
      reason:
        "You have not practiced interviews recently. A single timed mock keeps pacing and explanation skills fresh.",
      metadata: {
        interviewType: "SingleProblem",
        reasonCode: "stale_interview_practice",
        latestCompletedAt: latestCompletedAt?.toISOString() ?? null,
      },
      evidence: [
        latestCompletedAt
          ? `Last completed interview: ${latestCompletedAt.toISOString()}`
          : "No recent interview practice",
      ],
    });
  }

  return null;
}

async function getDailyForgeRecommendation({
  userProfileId,
  patternMetrics,
  feedbackProfile,
}: {
  userProfileId: string;
  patternMetrics: PatternMetric[];
  feedbackProfile: RecommendationFeedbackProfile;
}): Promise<RecommendationCandidate> {
  const fallbackPattern = getFallbackPattern(patternMetrics);
  const pickedProblem = fallbackPattern
    ? await pickPracticeProblemForPattern(userProfileId, fallbackPattern.patternId, {
        difficultyPreference: getDifficultyPreferenceForRecommendation(
          feedbackProfile,
          "DailyForge",
          fallbackPattern.patternId,
        ),
      })
    : null;

  return buildDailyForgeRecommendation({
    targetPatternId: fallbackPattern?.patternId,
    patternName: fallbackPattern?.patternName,
    problemId: pickedProblem?.problemId,
  });
}

function compactRecommendations(
  recommendations: Array<RecommendationCandidate | null>,
): RecommendationCandidate[] {
  const byDedupeKey = new Map<string, RecommendationCandidate>();

  for (const recommendation of recommendations) {
    if (!recommendation) {
      continue;
    }

    const key = getRecommendationDedupeKey(recommendation);
    const existing = byDedupeKey.get(key);

    if (!existing || recommendation.priority < existing.priority) {
      byDedupeKey.set(key, recommendation);
    }
  }

  return sortRecommendations(Array.from(byDedupeKey.values()));
}

async function getRecommendationFeedbackProfile(
  userProfileId: string,
): Promise<RecommendationFeedbackProfile> {
  const rows = await getPrisma().recommendationFeedback.findMany({
    where: { userProfileId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      feedbackType: true,
      createdAt: true,
      recommendation: {
        select: {
          recommendationType: true,
          targetPatternId: true,
          secondaryPatternId: true,
        },
      },
    },
  });

  return deriveRecommendationFeedbackProfile(
    rows.map((row) => ({
      feedbackType: row.feedbackType,
      recommendationType: row.recommendation.recommendationType,
      targetPatternId: row.recommendation.targetPatternId,
      secondaryPatternId: row.recommendation.secondaryPatternId,
      createdAt: row.createdAt,
    })),
  );
}

export async function generateRecommendations(
  userProfileId: string,
): Promise<RecommendationCandidate[]> {
  const scopedUserProfileId = normalizeUserProfileId(userProfileId);

  if (!scopedUserProfileId) {
    return [];
  }

  const [reviewStats, patternMetrics, feedbackProfile, codeExecution] = await Promise.all([
    getReviewStats(scopedUserProfileId),
    getPatternMetrics(scopedUserProfileId),
    getRecommendationFeedbackProfile(scopedUserProfileId),
    getCodeExecutionMetrics(scopedUserProfileId),
  ]);
  const dueReviewRecommendation =
    reviewStats.totalDueCount >= DUE_REVIEW_THRESHOLD
      ? buildDueReviewRecommendation({
          dueFlashcardsCount: reviewStats.dueFlashcardsCount,
          dueMistakesCount: reviewStats.dueMistakesCount,
        })
      : null;
  const [
    activeBattleRecommendation,
    activeInterviewRecommendation,
    highWeaknessRecommendation,
    communicationRecommendation,
    confusionRecommendation,
    failedBattleRecommendation,
    learningPlanStepRecommendation,
    interviewReadinessRecommendation,
    codeExecutionRecommendations,
    dailyForgeRecommendation,
  ] = await Promise.all([
    getActiveBattleRecommendation(scopedUserProfileId),
    getActiveInterviewRecommendation(scopedUserProfileId),
    getHighWeaknessRecommendation({
      userProfileId: scopedUserProfileId,
      patternMetrics,
      feedbackProfile,
    }),
    getCommunicationRecommendation({
      userProfileId: scopedUserProfileId,
      patternMetrics,
      codeExecution,
    }),
    getConfusionRecommendation(scopedUserProfileId, feedbackProfile),
    getFailedBattleRecommendation(scopedUserProfileId, feedbackProfile),
    getLearningPlanStepRecommendation(scopedUserProfileId),
    getInterviewReadinessRecommendation({
      userProfileId: scopedUserProfileId,
      patternMetrics,
      dueReviewCount: reviewStats.totalDueCount,
    }),
    getCodeExecutionRecommendations({
      userProfileId: scopedUserProfileId,
      patternMetrics,
      codeExecution,
    }),
    getDailyForgeRecommendation({
      userProfileId: scopedUserProfileId,
      patternMetrics,
      feedbackProfile,
    }),
  ]);

  return applyRecommendationFeedbackPersonalization(
    compactRecommendations([
      dueReviewRecommendation,
      activeBattleRecommendation,
      activeInterviewRecommendation,
      highWeaknessRecommendation,
      communicationRecommendation,
      interviewReadinessRecommendation,
      confusionRecommendation,
      failedBattleRecommendation,
      learningPlanStepRecommendation,
      ...codeExecutionRecommendations,
      getReadyForBossRecommendation(patternMetrics),
      dailyForgeRecommendation,
    ]),
    feedbackProfile,
  );
}

export async function getNextBestAction(
  userProfileId: string,
): Promise<RecommendationCandidate | null> {
  return selectNextBestAction(await generateRecommendations(userProfileId));
}

export async function expireOldRecommendations(
  userProfileId: string,
  now = new Date(),
): Promise<number> {
  const scopedUserProfileId = normalizeUserProfileId(userProfileId);

  if (!scopedUserProfileId) {
    return 0;
  }

  const result = await getPrisma().recommendation.updateMany({
    where: {
      userProfileId: scopedUserProfileId,
      status: "Active",
      expiresAt: { lt: now },
    },
    data: {
      status: "Expired",
    },
  });

  return result.count;
}

export async function saveRecommendations(
  userProfileId: string,
): Promise<RecommendationCandidate[]> {
  const scopedUserProfileId = normalizeUserProfileId(userProfileId);

  if (!scopedUserProfileId) {
    return [];
  }

  await expireOldRecommendations(scopedUserProfileId);

  const recommendations = await generateRecommendations(scopedUserProfileId);
  const expiresAt = getDefaultExpiresAt();

  for (const recommendation of recommendations) {
    const existing = await getPrisma().recommendation.findFirst({
      where: {
        userProfileId: scopedUserProfileId,
        OR: [
          { status: "Active" },
          {
            status: "Dismissed",
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        ],
        recommendationType: recommendation.recommendationType,
        targetPatternId: recommendation.targetPatternId ?? null,
        secondaryPatternId: recommendation.secondaryPatternId ?? null,
        problemId: recommendation.problemId ?? null,
        battleType: recommendation.battleType ?? null,
      },
      select: { id: true, status: true },
    });
    const data = {
      priority: recommendation.priority,
      title: recommendation.title,
      reason: recommendation.reason,
      metadata: withPersistenceMetadata(recommendation),
      expiresAt,
    };

    if (existing?.status === "Dismissed") {
      continue;
    }

    if (existing) {
      await getPrisma().recommendation.update({
        where: { id: existing.id },
        data,
      });
      continue;
    }

    await getPrisma().recommendation.create({
      data: {
        userProfileId: scopedUserProfileId,
        recommendationType: recommendation.recommendationType,
        priority: recommendation.priority,
        status: "Active",
        title: recommendation.title,
        reason: recommendation.reason,
        targetPatternId: recommendation.targetPatternId,
        secondaryPatternId: recommendation.secondaryPatternId,
        problemId: recommendation.problemId,
        battleType: recommendation.battleType,
        metadata: withPersistenceMetadata(recommendation),
        expiresAt,
      },
    });
  }

  return recommendations;
}

async function updateRecommendationStatus(
  userProfileId: string,
  recommendationId: string,
  status: "Accepted" | "Completed" | "Dismissed",
): Promise<RecommendationStatusUpdateResult> {
  const scopedUserProfileId = normalizeUserProfileId(userProfileId);
  const scopedRecommendationId = recommendationId.trim();

  if (!scopedUserProfileId || !scopedRecommendationId) {
    return { status: "not_found" };
  }

  const result = await getPrisma().recommendation.updateMany({
    where: {
      id: scopedRecommendationId,
      userProfileId: scopedUserProfileId,
    },
    data: { status },
  });

  return result.count === 0
    ? { status: "not_found" }
    : { status: "updated", recommendationId: scopedRecommendationId };
}

export async function markRecommendationAccepted(
  userProfileId: string,
  recommendationId: string,
): Promise<RecommendationStatusUpdateResult> {
  return updateRecommendationStatus(userProfileId, recommendationId, "Accepted");
}

export async function markRecommendationCompleted(
  userProfileId: string,
  recommendationId: string,
): Promise<RecommendationStatusUpdateResult> {
  return updateRecommendationStatus(userProfileId, recommendationId, "Completed");
}

export async function dismissRecommendation(
  userProfileId: string,
  recommendationId: string,
): Promise<RecommendationStatusUpdateResult> {
  return updateRecommendationStatus(userProfileId, recommendationId, "Dismissed");
}

export async function createRecommendationFeedback(
  userProfileId: string,
  recommendationId: string,
  feedbackType: RecommendationFeedbackType,
  note?: string,
): Promise<RecommendationFeedbackCreateResult> {
  const scopedUserProfileId = normalizeUserProfileId(userProfileId);
  const scopedRecommendationId = recommendationId.trim();
  const scopedNote = note?.trim();

  if (!scopedUserProfileId || !scopedRecommendationId) {
    return { status: "not_found" };
  }

  const recommendation = await getPrisma().recommendation.findFirst({
    where: {
      id: scopedRecommendationId,
      userProfileId: scopedUserProfileId,
    },
    select: { id: true },
  });

  if (!recommendation) {
    return { status: "not_found" };
  }

  const feedback = await getPrisma().recommendationFeedback.create({
    data: {
      userProfileId: scopedUserProfileId,
      recommendationId: scopedRecommendationId,
      feedbackType,
      note: scopedNote || undefined,
    },
    select: { id: true },
  });

  if (feedbackType === "Dismissed") {
    await updateRecommendationStatus(
      scopedUserProfileId,
      scopedRecommendationId,
      "Dismissed",
    );
  }

  if (feedbackType === "NotRelevant") {
    await getPrisma().recommendation.updateMany({
      where: {
        id: scopedRecommendationId,
        userProfileId: scopedUserProfileId,
      },
      data: { status: "Expired" },
    });
  }

  return {
    status: "recorded",
    recommendationId: scopedRecommendationId,
    feedbackId: feedback.id,
  };
}
