import type {
  InterviewReadinessLabel,
  PatternConfusionMetric,
  PatternMetric,
  ReadinessScoreBreakdown,
} from "./types";

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : clampScore((count / total) * 100);
}

function average(values: number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  return finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length;
}

function hasActivity(patternMetric: PatternMetric): boolean {
  return (
    patternMetric.attemptsCount > 0 ||
    patternMetric.reviewCount > 0 ||
    patternMetric.battleCount > 0
  );
}

export function getInterviewReadinessLabel(score: number): InterviewReadinessLabel {
  if (score >= 80) {
    return "Interview-Ready";
  }

  if (score >= 65) {
    return "Battle-Tested";
  }

  if (score >= 45) {
    return "Pattern-Aware";
  }

  if (score >= 20) {
    return "Building Foundation";
  }

  return "Just Starting";
}

export function calculateReadinessScoreBreakdown(
  patternMetrics: PatternMetric[],
  confusions: PatternConfusionMetric[],
  interviewPerformanceScore = 60,
): ReadinessScoreBreakdown {
  const activePatternMetrics = patternMetrics.filter(hasActivity);
  const totalAttempts = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.attemptsCount,
    0,
  );
  const totalSolved = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.solvedCount,
    0,
  );
  const battleCount = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.battleCount,
    0,
  );
  const battleVictoryCount = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.battleVictoryCount,
    0,
  );
  const totalMistakesAndCards = patternMetrics.reduce(
    (total, patternMetric) =>
      total + patternMetric.mistakeCount + patternMetric.flashcardCount,
    0,
  );
  const totalReviews = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.reviewCount,
    0,
  );
  const totalLapses = patternMetrics.reduce(
    (total, patternMetric) => total + patternMetric.lapseCount,
    0,
  );
  const averageConfidence =
    average(
      activePatternMetrics
        .map((patternMetric) => patternMetric.averageConfidence)
        .filter((value): value is number => value !== null),
    ) ?? 0;
  const reviewRecoveryBase =
    totalMistakesAndCards === 0
      ? totalAttempts > 0
        ? 60
        : 0
      : percentage(totalReviews, totalMistakesAndCards);
  const confusionPenalty = Math.min(
    25,
    confusions.reduce((total, confusion) => total + confusion.count, 0) * 3,
  );

  return {
    patternCoverage: percentage(activePatternMetrics.length, patternMetrics.length),
    patternRecognition: clampScore(
      average(
        activePatternMetrics.map(
          (patternMetric) => patternMetric.recognitionAccuracy,
        ),
      ) ?? 0,
    ),
    solveConsistency: percentage(totalSolved, totalAttempts),
    retention: clampScore(
      average(
        activePatternMetrics
          .map((patternMetric) => patternMetric.retentionScore)
          .filter((value): value is number => value !== null),
      ) ?? 0,
    ),
    bossBattlePerformance: percentage(battleVictoryCount, battleCount),
    interviewPerformance: clampScore(interviewPerformanceScore),
    mistakeRecovery: clampScore(
      reviewRecoveryBase - Math.min(30, totalLapses * 4) - confusionPenalty,
    ),
    confidence: clampScore((averageConfidence / 5) * 100),
  };
}

export function getOverallReadinessScore(scores: ReadinessScoreBreakdown): number {
  return clampScore(
    scores.patternCoverage * 0.13 +
      scores.patternRecognition * 0.16 +
      scores.solveConsistency * 0.15 +
      scores.retention * 0.12 +
      scores.bossBattlePerformance * 0.1 +
      scores.interviewPerformance * 0.16 +
      scores.mistakeRecovery * 0.09 +
      scores.confidence * 0.09,
  );
}
