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
  _confusions: PatternConfusionMetric[],
  interviewPerformanceScore = 60,
  codeExecutionDebuggingScore = 60,
  communicationScore = 60,
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
  const averageConfidence =
    average(
      activePatternMetrics
        .map((patternMetric) => patternMetric.averageConfidence)
        .filter((value): value is number => value !== null),
    ) ?? 0;

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
    codeExecutionDebugging: clampScore(codeExecutionDebuggingScore),
    communication: clampScore(communicationScore),
    confidence: clampScore((averageConfidence / 5) * 100),
  };
}

export function getOverallReadinessScore(scores: ReadinessScoreBreakdown): number {
  return clampScore(
    scores.patternCoverage * 0.11 +
      scores.patternRecognition * 0.14 +
      scores.solveConsistency * 0.14 +
      scores.retention * 0.11 +
      scores.bossBattlePerformance * 0.09 +
      scores.interviewPerformance * 0.14 +
      scores.codeExecutionDebugging * 0.1 +
      scores.communication * 0.1 +
      scores.confidence * 0.07,
  );
}
