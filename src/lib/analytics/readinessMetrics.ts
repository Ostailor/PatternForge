import "server-only";

import type {
  InterviewResult,
  RubricCategory,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

import { getCodeExecutionMetrics } from "./codeExecutionMetrics";
import { getPatternConfusions } from "./confusionMetrics";
import { getPatternMetrics, getWeakestPatternMetric } from "./patternMetrics";
import {
  calculateReadinessScoreBreakdown,
  getInterviewReadinessLabel,
  getOverallReadinessScore,
} from "./readinessScoring";
import { getUserLearningMetrics } from "./userMetrics";
import type {
  PatternConfusionMetric,
  PatternMetric,
  PatternSummary,
  InterviewReadinessPerformance,
  ReadinessMetrics,
  ReadinessNextSevenDay,
  ReadinessPatternSectionItem,
  ReadinessReport,
} from "./types";

const READY_MASTERY_THRESHOLD = 76;
const READY_RECOGNITION_THRESHOLD = 70;
const RISK_MASTERY_THRESHOLD = 51;
const RISK_RETENTION_THRESHOLD = 60;
const PRACTICE_VOLUME_TARGET = 30;
const NO_INTERVIEW_SCORE_BASELINE = 60;

const rubricCategories: RubricCategory[] = [
  "Communication",
  "PatternRecognition",
  "ProblemSolving",
  "Implementation",
  "Testing",
  "Complexity",
  "TimeManagement",
];

const resultStrength: Record<InterviewResult, number> = {
  StrongHire: 5,
  Hire: 4,
  LeanHire: 3,
  LeanNoHire: 2,
  NoHire: 1,
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function average(values: number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMissedSignals(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const missedSignals = value.missedSignals;

  if (!Array.isArray(missedSignals)) {
    return [];
  }

  return missedSignals.filter(
    (missedSignal): missedSignal is string =>
      typeof missedSignal === "string" && missedSignal.trim().length > 0,
  );
}

function summarize(patternMetric: PatternMetric): PatternSummary {
  return {
    patternId: patternMetric.patternId,
    patternName: patternMetric.patternName,
    masteryScore: patternMetric.masteryScore,
  };
}

function hasActivity(patternMetric: PatternMetric): boolean {
  return (
    patternMetric.attemptsCount > 0 ||
    patternMetric.reviewCount > 0 ||
    patternMetric.battleCount > 0
  );
}

function isPatternReady(patternMetric: PatternMetric): boolean {
  return (
    patternMetric.masteryScore >= READY_MASTERY_THRESHOLD &&
    patternMetric.recognitionAccuracy >= READY_RECOGNITION_THRESHOLD &&
    (patternMetric.retentionScore ?? READY_RECOGNITION_THRESHOLD) >= 65 &&
    patternMetric.attemptsCount > 0
  );
}

function isPatternAtRisk(patternMetric: PatternMetric): boolean {
  if (!hasActivity(patternMetric)) {
    return false;
  }

  return (
    patternMetric.masteryScore < RISK_MASTERY_THRESHOLD ||
    patternMetric.recognitionAccuracy < RISK_RETENTION_THRESHOLD ||
    (patternMetric.retentionScore !== null &&
      patternMetric.retentionScore < RISK_RETENTION_THRESHOLD) ||
    patternMetric.lapseCount >= 2
  );
}

function getRecommendedFocusPattern(
  patternsAtRisk: PatternSummary[],
  patternMetrics: PatternMetric[],
): PatternSummary | null {
  return (
    patternsAtRisk[0] ??
    getWeakestPatternMetric(patternMetrics) ??
    null
  );
}

function summarizePatternItem(
  patternMetric: PatternMetric,
  reason: string,
): ReadinessPatternSectionItem {
  return {
    ...patternMetric,
    reason,
  };
}

function getActivePatternMetrics(patternMetrics: PatternMetric[]): PatternMetric[] {
  return patternMetrics.filter(hasActivity);
}

function getBestInterviewResult(
  results: Array<InterviewResult | null>,
): InterviewResult | null {
  return (
    results
      .filter((result): result is InterviewResult => result !== null)
      .sort((a, b) => resultStrength[b] - resultStrength[a])[0] ?? null
  );
}

function getRecommendedNextMock({
  completedCount,
  averageOverallScore,
  lowestScoringCategories,
  missedPatterns,
  commonMissedSignals,
}: {
  completedCount: number;
  averageOverallScore: number | null;
  lowestScoringCategories: InterviewReadinessPerformance["lowestScoringCategories"];
  missedPatterns: InterviewReadinessPerformance["missedPatterns"];
  commonMissedSignals: InterviewReadinessPerformance["commonMissedSignals"];
}): InterviewReadinessPerformance["recommendedNextMock"] {
  if (completedCount === 0) {
    return {
      interviewType: "SingleProblem",
      title: "Take your first mock interview.",
      reason:
        "Start with one timed problem to create a baseline without overloading the session.",
      href: "/interviews",
    };
  }

  const weakestCategory = lowestScoringCategories[0]?.category ?? null;
  const missedPattern = missedPatterns[0] ?? null;

  if (weakestCategory === "PatternRecognition" && missedPattern) {
    return {
      interviewType: "FocusedPattern",
      title: `Focused ${missedPattern.patternName} interview`,
      reason:
        "Your interview misses point to a specific pattern, so a focused mock gives the cleanest repair signal.",
      href: "/interviews",
    };
  }

  if (
    commonMissedSignals.length > 0 ||
    lowestScoringCategories.some((category) => category.averageScore < 65)
  ) {
    return {
      interviewType: "WeaknessRepair",
      title: "Weakness repair interview",
      reason:
        "Use a targeted mock to pressure-test the lowest rubric areas and missed signals.",
      href: "/interviews",
    };
  }

  if ((averageOverallScore ?? 0) >= 76 && completedCount >= 2) {
    return {
      interviewType: "MixedInterview",
      title: "Mixed interview",
      reason:
        "Your recent mock data is strong enough to test pattern transfer across multiple rounds.",
      href: "/interviews",
    };
  }

  return {
    interviewType: "SingleProblem",
    title: "Single problem interview",
    reason:
      "One timed round is the safest next step for improving pacing and explanation quality.",
    href: "/interviews",
  };
}

async function getInterviewReadinessPerformance(
  userProfileId: string,
): Promise<InterviewReadinessPerformance> {
  const prisma = getPrisma();
  const [completedInterviews, rubricScores, feedbackRecords, rounds] =
    await Promise.all([
      prisma.interviewSession.findMany({
        where: {
          userProfileId,
          status: "Completed",
        },
        select: {
          id: true,
          title: true,
          result: true,
          overallScore: true,
          completedAt: true,
        },
        orderBy: {
          completedAt: "asc",
        },
      }),
      prisma.interviewRubricScore.findMany({
        where: {
          interviewSession: {
            userProfileId,
            status: "Completed",
          },
        },
        select: {
          category: true,
          score: true,
        },
      }),
      prisma.interviewFeedback.findMany({
        where: {
          interviewSession: {
            userProfileId,
            status: "Completed",
          },
        },
        select: {
          rubric: true,
        },
      }),
      prisma.interviewRound.findMany({
        where: {
          interviewSession: {
            userProfileId,
            status: "Completed",
          },
        },
        select: {
          selectedPatternId: true,
          correctPatternId: true,
          correctPattern: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);
  const scoredInterviews = completedInterviews.filter(
    (interview) => typeof interview.overallScore === "number",
  );
  const averageOverallScore =
    scoredInterviews.length === 0
      ? null
      : clampScore(
          scoredInterviews.reduce(
            (total, interview) => total + (interview.overallScore ?? 0),
            0,
          ) / scoredInterviews.length,
        );
  const latestInterview = completedInterviews.at(-1) ?? null;
  const scoreByCategory = rubricScores.reduce(
    (summary, rubricScore) => {
      const current = summary.get(rubricScore.category) ?? {
        total: 0,
        count: 0,
      };

      current.total += rubricScore.score;
      current.count += 1;
      summary.set(rubricScore.category, current);

      return summary;
    },
    new Map<RubricCategory, { total: number; count: number }>(),
  );
  const rubricBreakdown = rubricCategories.map((category) => {
    const categoryScores = scoreByCategory.get(category);

    return {
      category,
      averageScore: categoryScores
        ? clampScore(categoryScores.total / categoryScores.count)
        : null,
      count: categoryScores?.count ?? 0,
    };
  });
  const lowestScoringCategories = rubricBreakdown
    .filter(
      (category): category is {
        category: RubricCategory;
        averageScore: number;
        count: number;
      } => category.averageScore !== null,
    )
    .sort(
      (a, b) =>
        a.averageScore - b.averageScore || a.category.localeCompare(b.category),
    )
    .slice(0, 3)
    .map((category) => ({
      category: category.category,
      averageScore: category.averageScore,
    }));
  const missedSignalCounts = new Map<string, number>();

  for (const feedback of feedbackRecords) {
    for (const missedSignal of readMissedSignals(feedback.rubric)) {
      const normalized = missedSignal.trim();
      missedSignalCounts.set(
        normalized,
        (missedSignalCounts.get(normalized) ?? 0) + 1,
      );
    }
  }

  const missedPatternCounts = new Map<
    string,
    { patternId: string; patternName: string; count: number }
  >();

  for (const round of rounds) {
    if (round.selectedPatternId === round.correctPatternId) {
      continue;
    }

    const current = missedPatternCounts.get(round.correctPattern.id) ?? {
      patternId: round.correctPattern.id,
      patternName: round.correctPattern.name,
      count: 0,
    };

    current.count += 1;
    missedPatternCounts.set(round.correctPattern.id, current);
  }

  const commonMissedSignals = Array.from(missedSignalCounts.entries())
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal))
    .slice(0, 5);
  const missedPatterns = Array.from(missedPatternCounts.values())
    .sort((a, b) => b.count - a.count || a.patternName.localeCompare(b.patternName))
    .slice(0, 5);

  return {
    completedCount: completedInterviews.length,
    averageOverallScore,
    bestResult: getBestInterviewResult(
      completedInterviews.map((interview) => interview.result),
    ),
    latestResult: latestInterview?.result ?? null,
    scoreTrend: scoredInterviews.slice(-8).map((interview) => ({
      id: interview.id,
      title: interview.title,
      date: interview.completedAt?.toISOString() ?? null,
      score: interview.overallScore ?? 0,
    })),
    rubricBreakdown,
    lowestScoringCategories,
    commonMissedSignals,
    missedPatterns,
    recommendedNextMock: getRecommendedNextMock({
      completedCount: completedInterviews.length,
      averageOverallScore,
      lowestScoringCategories,
      missedPatterns,
      commonMissedSignals,
    }),
  };
}

function getInterviewPerformanceScore(
  performance: InterviewReadinessPerformance,
): number {
  if (performance.completedCount === 0) {
    return NO_INTERVIEW_SCORE_BASELINE;
  }

  const latestScore = performance.scoreTrend.at(-1)?.score ?? null;
  const trendBonus =
    performance.scoreTrend.length >= 2 && latestScore !== null
      ? Math.max(
          -8,
          Math.min(
            8,
            latestScore - performance.scoreTrend[performance.scoreTrend.length - 2].score,
          ),
        )
      : 0;
  const rubricAverage = average(
    performance.rubricBreakdown
      .map((rubric) => rubric.averageScore)
      .filter((score): score is number => score !== null),
  );

  return clampScore(
    (performance.averageOverallScore ?? 0) * 0.75 +
      (rubricAverage ?? performance.averageOverallScore ?? 0) * 0.2 +
      trendBonus * 0.05,
  );
}

function getStrongestPatterns(
  patternMetrics: PatternMetric[],
): ReadinessPatternSectionItem[] {
  return getActivePatternMetrics(patternMetrics)
    .slice()
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        b.solveRate - a.solveRate ||
        b.recognitionAccuracy - a.recognitionAccuracy ||
        a.patternName.localeCompare(b.patternName),
    )
    .slice(0, 5)
    .map((patternMetric) =>
      summarizePatternItem(
        patternMetric,
        `Mastery ${patternMetric.masteryScore}%, recognition ${patternMetric.recognitionAccuracy}%, solve rate ${patternMetric.solveRate}%.`,
      ),
    );
}

function getWeakestPatterns(
  patternMetrics: PatternMetric[],
): ReadinessPatternSectionItem[] {
  return getActivePatternMetrics(patternMetrics)
    .slice()
    .sort(
      (a, b) =>
        a.masteryScore - b.masteryScore ||
        a.solveRate - b.solveRate ||
        a.recognitionAccuracy - b.recognitionAccuracy ||
        b.lapseCount - a.lapseCount ||
        a.patternName.localeCompare(b.patternName),
    )
    .slice(0, 5)
    .map((patternMetric) =>
      summarizePatternItem(
        patternMetric,
        `Mastery ${patternMetric.masteryScore}%, solve rate ${patternMetric.solveRate}%, ${patternMetric.mistakeCount} mistake${patternMetric.mistakeCount === 1 ? "" : "s"}.`,
      ),
    );
}

function getPatternsReadyForBoss(
  patternMetrics: PatternMetric[],
): ReadinessPatternSectionItem[] {
  return patternMetrics
    .filter(isPatternReady)
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        (b.retentionScore ?? 0) - (a.retentionScore ?? 0) ||
        a.patternName.localeCompare(b.patternName),
    )
    .slice(0, 5)
    .map((patternMetric) =>
      summarizePatternItem(
        patternMetric,
        `Mastery ${patternMetric.masteryScore}% with ${patternMetric.retentionScore ?? 0}% retention signal.`,
      ),
    );
}

function getPatternsNeedingReview(
  patternMetrics: PatternMetric[],
): ReadinessPatternSectionItem[] {
  return getActivePatternMetrics(patternMetrics)
    .filter(
      (patternMetric) =>
        (patternMetric.retentionScore !== null &&
          patternMetric.retentionScore < RISK_RETENTION_THRESHOLD) ||
        patternMetric.lapseCount > 0 ||
        patternMetric.daysSincePractice === null ||
        patternMetric.daysSincePractice >= 7,
    )
    .sort(
      (a, b) =>
        (a.retentionScore ?? 0) - (b.retentionScore ?? 0) ||
        b.lapseCount - a.lapseCount ||
        (b.daysSincePractice ?? 0) - (a.daysSincePractice ?? 0) ||
        a.patternName.localeCompare(b.patternName),
    )
    .slice(0, 5)
    .map((patternMetric) =>
      summarizePatternItem(
        patternMetric,
        patternMetric.retentionScore === null
          ? "No review retention signal yet."
          : `Retention ${patternMetric.retentionScore}% with ${patternMetric.lapseCount} lapse${patternMetric.lapseCount === 1 ? "" : "s"}.`,
      ),
    );
}

function buildRecommendedNextSevenDays({
  weakestPatterns,
  confusingPatternPairs,
  patternsReadyForBoss,
  patternsNeedingReview,
}: {
  weakestPatterns: ReadinessPatternSectionItem[];
  confusingPatternPairs: PatternConfusionMetric[];
  patternsReadyForBoss: ReadinessPatternSectionItem[];
  patternsNeedingReview: ReadinessPatternSectionItem[];
}): ReadinessNextSevenDay[] {
  const focusPattern = weakestPatterns[0];
  const reviewPattern = patternsNeedingReview[0] ?? focusPattern;
  const confusion = confusingPatternPairs[0];
  const bossPattern = patternsReadyForBoss[0];

  return [
    {
      dayIndex: 0,
      title: reviewPattern
        ? `Review ${reviewPattern.patternName}`
        : "Start with Daily Review",
      description: reviewPattern
        ? "Refresh memory before adding harder reps."
        : "Create your first review signals so readiness has a retention baseline.",
      href: "/review",
    },
    {
      dayIndex: 1,
      title: focusPattern
        ? `Focused ${focusPattern.patternName} practice`
        : "Focused Arrays & Hashing practice",
      description: "Take one targeted problem and write a short reflection.",
      href: `/forge?pattern=${focusPattern?.patternId ?? "arrays-hashing"}`,
    },
    {
      dayIndex: 2,
      title: confusion
        ? `${confusion.selectedPatternName} vs ${confusion.correctPatternName}`
        : "Pattern recognition drill",
      description: confusion
        ? "Contrast the pair you have mixed up most often."
        : "Practice identifying the pattern before opening implementation details.",
      href: confusion
        ? `/drills/contrast/${confusion.selectedPatternId}/${confusion.correctPatternId}`
        : "/forge",
    },
    {
      dayIndex: 3,
      title: "Mixed Daily Forge",
      description: "Blend one weak pattern with one older pattern to test transfer.",
      href: "/forge",
    },
    {
      dayIndex: 4,
      title: reviewPattern
        ? `Retention check: ${reviewPattern.patternName}`
        : "Retention check",
      description: "Clear due reviews and retry any mistake cards that still feel slow.",
      href: "/review",
    },
    {
      dayIndex: 5,
      title: bossPattern
        ? `${bossPattern.patternName} boss prep`
        : "Boss prep fundamentals",
      description: bossPattern
        ? "You have enough signal to pressure-test this pattern."
        : "Build toward boss readiness with one medium-difficulty focused rep.",
      href: bossPattern ? "/battles" : "/forge",
    },
    {
      dayIndex: 6,
      title: "Readiness reflection",
      description: "Review misses, confidence, and the next week’s weakest pattern.",
      href: "/plans",
    },
  ];
}

export async function getReadinessReport(
  userProfileId: string,
): Promise<ReadinessReport> {
  const scopedUserProfileId = userProfileId.trim();
  const [patternMetrics, confusions, interviewPerformance, codeExecution] = await Promise.all([
    getPatternMetrics(scopedUserProfileId),
    getPatternConfusions(scopedUserProfileId),
    getInterviewReadinessPerformance(scopedUserProfileId),
    getCodeExecutionMetrics(scopedUserProfileId),
  ]);
  const scoreBreakdown = calculateReadinessScoreBreakdown(
    patternMetrics,
    confusions,
    getInterviewPerformanceScore(interviewPerformance),
  );
  const strongestPatterns = getStrongestPatterns(patternMetrics);
  const weakestPatterns = getWeakestPatterns(patternMetrics);
  const confusingPatternPairs = confusions.slice(0, 5);
  const patternsReadyForBoss = getPatternsReadyForBoss(patternMetrics);
  const patternsNeedingReview = getPatternsNeedingReview(patternMetrics);
  const overallReadinessScore = getOverallReadinessScore(scoreBreakdown);

  return {
    overallReadinessScore,
    interviewReadinessLabel: getInterviewReadinessLabel(overallReadinessScore),
    scoreBreakdown,
    totalPatterns: patternMetrics.length,
    activePatternCount: getActivePatternMetrics(patternMetrics).length,
    totalAttempts: patternMetrics.reduce(
      (total, patternMetric) => total + patternMetric.attemptsCount,
      0,
    ),
    strongestPatterns,
    weakestPatterns,
    confusingPatternPairs,
    patternsReadyForBoss,
    patternsNeedingReview,
    interviewPerformance,
    codeExecution,
    recommendedNextSevenDays: buildRecommendedNextSevenDays({
      weakestPatterns,
      confusingPatternPairs,
      patternsReadyForBoss,
      patternsNeedingReview,
    }),
  };
}

export async function getReadinessMetrics(
  userProfileId: string,
): Promise<ReadinessMetrics> {
  const scopedUserProfileId = userProfileId.trim();
  const [patternMetrics, userMetrics] = await Promise.all([
    getPatternMetrics(scopedUserProfileId),
    getUserLearningMetrics(scopedUserProfileId),
  ]);
  const activePatternMetrics = patternMetrics.filter(hasActivity);
  const averageMastery = average(
    activePatternMetrics.map((patternMetric) => patternMetric.masteryScore),
  ) ?? 0;
  const practiceVolumeScore = clampScore(
    (userMetrics.totalAttempts / PRACTICE_VOLUME_TARGET) * 100,
  );
  const patternsReady = patternMetrics
    .filter(isPatternReady)
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        b.recognitionAccuracy - a.recognitionAccuracy ||
        a.patternName.localeCompare(b.patternName),
    )
    .map(summarize);
  const patternsAtRisk = patternMetrics
    .filter(isPatternAtRisk)
    .sort(
      (a, b) =>
        a.masteryScore - b.masteryScore ||
        a.recognitionAccuracy - b.recognitionAccuracy ||
        b.lapseCount - a.lapseCount ||
        a.patternName.localeCompare(b.patternName),
    )
    .map(summarize);
  const overallReadinessScore = clampScore(
    averageMastery * 0.4 +
      userMetrics.overallRecognitionAccuracy * 0.2 +
      (userMetrics.overallRetentionScore ?? 0) * 0.15 +
      userMetrics.battleWinRate * 0.15 +
      practiceVolumeScore * 0.1,
  );

  return {
    overallReadinessScore,
    interviewReadinessLabel: getInterviewReadinessLabel(overallReadinessScore),
    patternsReady,
    patternsAtRisk,
    recommendedFocusPattern: getRecommendedFocusPattern(
      patternsAtRisk,
      patternMetrics,
    ),
  };
}
