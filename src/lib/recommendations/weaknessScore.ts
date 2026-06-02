import type {
  PatternConfusionMetric,
  PatternMetric,
} from "@/lib/analytics/types";
import type {
  PatternWeaknessScore,
  RecommendedActionType,
  WeaknessPatternInput,
  WeaknessSeverity,
} from "./types";

const MASTERY_GAP_WEIGHT = 0.3;
const RECOGNITION_GAP_WEIGHT = 0.2;
const SOLVE_RATE_GAP_WEIGHT = 0.15;
const RETENTION_RISK_WEIGHT = 0.15;
const MISTAKE_PRESSURE_WEIGHT = 0.1;
const BATTLE_WEAKNESS_WEIGHT = 0.05;
const RECENCY_GAP_WEIGHT = 0.05;

const LOW_RECOGNITION_THRESHOLD = 65;
const HIGH_RECOGNITION_THRESHOLD = 75;
const LOW_SOLVE_RATE_THRESHOLD = 60;
const LOW_RETENTION_THRESHOLD = 60;
const HIGH_MASTERY_THRESHOLD = 80;
const HIGH_RETENTION_THRESHOLD = 80;
const CONFUSION_THRESHOLD = 2;
const RECENCY_FULL_GAP_DAYS = 21;

type ScoreBreakdown = {
  masteryGap: number;
  recognitionGap: number;
  solveRateGap: number;
  retentionRisk: number;
  mistakePressure: number;
  battleWeakness: number;
  recencyGap: number;
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, value));
}

function roundScore(value: number): number {
  return Math.round(clampScore(value));
}

function getGap(score: number): number {
  return clampScore(100 - clampScore(score));
}

function getRetentionRisk(retentionScore: number | null): number {
  return retentionScore === null ? 0 : getGap(retentionScore);
}

export function calculateMistakeLapsePressure({
  mistakeCount,
  lapseCount,
}: Pick<WeaknessPatternInput, "mistakeCount" | "lapseCount">): number {
  return clampScore(Math.max(0, mistakeCount) * 15 + Math.max(0, lapseCount) * 20);
}

export function calculateBattleWeakness({
  battleCount,
  battleVictoryCount,
  battlePartialVictoryCount = 0,
  battleDefeatCount = 0,
}: Pick<
  WeaknessPatternInput,
  | "battleCount"
  | "battleVictoryCount"
  | "battlePartialVictoryCount"
  | "battleDefeatCount"
>): number {
  if (battleCount <= 0) {
    return 0;
  }

  const knownBattleCount =
    battleVictoryCount + battlePartialVictoryCount + battleDefeatCount;
  const unresolvedNonVictories = Math.max(0, battleCount - knownBattleCount);
  const weightedWeakness =
    battleDefeatCount * 100 +
    (battlePartialVictoryCount + unresolvedNonVictories) * 55;

  return clampScore(weightedWeakness / battleCount);
}

export function calculateRecencyGap(daysSincePractice: number | null): number {
  if (daysSincePractice === null) {
    return 0;
  }

  return clampScore((Math.max(0, daysSincePractice) / RECENCY_FULL_GAP_DAYS) * 100);
}

function getScoreBreakdown(input: WeaknessPatternInput): ScoreBreakdown {
  return {
    masteryGap: getGap(input.masteryScore),
    recognitionGap: getGap(input.recognitionAccuracy),
    solveRateGap: getGap(input.solveRate),
    retentionRisk: getRetentionRisk(input.retentionScore),
    mistakePressure: calculateMistakeLapsePressure(input),
    battleWeakness: calculateBattleWeakness(input),
    recencyGap: calculateRecencyGap(input.daysSincePractice),
  };
}

function calculateWeightedWeaknessScore(breakdown: ScoreBreakdown): number {
  return roundScore(
    breakdown.masteryGap * MASTERY_GAP_WEIGHT +
      breakdown.recognitionGap * RECOGNITION_GAP_WEIGHT +
      breakdown.solveRateGap * SOLVE_RATE_GAP_WEIGHT +
      breakdown.retentionRisk * RETENTION_RISK_WEIGHT +
      breakdown.mistakePressure * MISTAKE_PRESSURE_WEIGHT +
      breakdown.battleWeakness * BATTLE_WEAKNESS_WEIGHT +
      breakdown.recencyGap * RECENCY_GAP_WEIGHT,
  );
}

function getSeverity(score: number): WeaknessSeverity {
  if (score >= 67) {
    return "High";
  }

  if (score >= 34) {
    return "Medium";
  }

  return "Low";
}

function getEvidence(input: WeaknessPatternInput, breakdown: ScoreBreakdown): string[] {
  const evidence = [
    `Mastery gap: ${roundScore(breakdown.masteryGap)}`,
    `Recognition gap: ${roundScore(breakdown.recognitionGap)}`,
    `Solve rate gap: ${roundScore(breakdown.solveRateGap)}`,
  ];

  if (input.retentionScore !== null) {
    evidence.push(`Retention risk: ${roundScore(breakdown.retentionRisk)}`);
  }

  if (input.mistakeCount > 0 || input.lapseCount > 0) {
    evidence.push(
      `Mistake/lapse pressure: ${roundScore(breakdown.mistakePressure)}`,
    );
  }

  if (input.battleCount > 0) {
    evidence.push(`Battle weakness: ${roundScore(breakdown.battleWeakness)}`);
  }

  if (input.daysSincePractice !== null) {
    evidence.push(`Days since practice: ${input.daysSincePractice}`);
  }

  if ((input.selectedIncorrectlyForOtherCount ?? 0) > 0) {
    evidence.push(
      `Incorrectly selected for another pattern: ${input.selectedIncorrectlyForOtherCount}`,
    );
  }

  return evidence;
}

function chooseRecommendation(input: WeaknessPatternInput): {
  recommendedActionType: RecommendedActionType;
  primaryReason: string;
} {
  const selectedIncorrectlyForOtherCount =
    input.selectedIncorrectlyForOtherCount ?? 0;

  if (selectedIncorrectlyForOtherCount >= CONFUSION_THRESHOLD) {
    return {
      recommendedActionType: "ContrastDrill",
      primaryReason:
        "This pattern is being confused with other patterns; run a contrast drill.",
    };
  }

  if (
    input.masteryScore >= HIGH_MASTERY_THRESHOLD &&
    (input.retentionScore ?? 100) >= HIGH_RETENTION_THRESHOLD
  ) {
    return {
      recommendedActionType: "BossBattle",
      primaryReason:
        "This pattern looks ready for pressure testing in a boss battle.",
    };
  }

  if (input.retentionScore !== null && input.retentionScore < LOW_RETENTION_THRESHOLD) {
    return {
      recommendedActionType: "ReviewGauntlet",
      primaryReason: "Retention is low; review before adding more practice.",
    };
  }

  if (input.recognitionAccuracy < LOW_RECOGNITION_THRESHOLD) {
    return {
      recommendedActionType: "FocusPattern",
      primaryReason:
        "Recognition accuracy is low; run a pattern recognition drill.",
    };
  }

  if (
    input.recognitionAccuracy >= HIGH_RECOGNITION_THRESHOLD &&
    input.solveRate < LOW_SOLVE_RATE_THRESHOLD
  ) {
    return {
      recommendedActionType: "RetryProblem",
      primaryReason:
        "Recognition is strong but solve rate is low; practice implementation.",
    };
  }

  return {
    recommendedActionType: "FocusPattern",
    primaryReason: "Mastery signals show this pattern still needs focused practice.",
  };
}

export function buildWeaknessPatternInputs(
  patternMetrics: PatternMetric[],
  patternConfusions: PatternConfusionMetric[] = [],
): WeaknessPatternInput[] {
  return patternMetrics.map((patternMetric) => {
    const selectedIncorrectlyForOtherCount = patternConfusions
      .filter((confusion) => confusion.selectedPatternId === patternMetric.patternId)
      .reduce((total, confusion) => total + confusion.count, 0);
    const inferredPartialVictoryCount = Math.max(
      0,
      patternMetric.battleCount - patternMetric.battleVictoryCount,
    );

    return {
      patternId: patternMetric.patternId,
      masteryScore: patternMetric.masteryScore,
      recognitionAccuracy: patternMetric.recognitionAccuracy,
      solveRate: patternMetric.solveRate,
      retentionScore: patternMetric.retentionScore,
      mistakeCount: patternMetric.mistakeCount,
      lapseCount: patternMetric.lapseCount,
      battleCount: patternMetric.battleCount,
      battleVictoryCount: patternMetric.battleVictoryCount,
      battlePartialVictoryCount: inferredPartialVictoryCount,
      battleDefeatCount: 0,
      daysSincePractice: patternMetric.daysSincePractice,
      attemptsCount: patternMetric.attemptsCount,
      selectedIncorrectlyForOtherCount,
    };
  });
}

export function calculatePatternWeakness(
  input: WeaknessPatternInput,
): PatternWeaknessScore {
  if (input.attemptsCount <= 0) {
    return {
      patternId: input.patternId,
      weaknessScore: 0,
      severity: "Unstarted",
      primaryReason: "This pattern has not been started yet.",
      evidence: ["No attempts recorded for this pattern."],
      recommendedActionType: "FocusPattern",
    };
  }

  const breakdown = getScoreBreakdown(input);
  const weaknessScore = calculateWeightedWeaknessScore(breakdown);
  const recommendation = chooseRecommendation(input);

  return {
    patternId: input.patternId,
    weaknessScore,
    severity: getSeverity(weaknessScore),
    primaryReason: recommendation.primaryReason,
    evidence: getEvidence(input, breakdown),
    recommendedActionType: recommendation.recommendedActionType,
  };
}

export function calculatePatternWeaknessScores(
  inputs: WeaknessPatternInput[],
): PatternWeaknessScore[] {
  return inputs
    .map(calculatePatternWeakness)
    .sort(
      (a, b) =>
        b.weaknessScore - a.weaknessScore ||
        a.severity.localeCompare(b.severity) ||
        a.patternId.localeCompare(b.patternId),
    );
}
