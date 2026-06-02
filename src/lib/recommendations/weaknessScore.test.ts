import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWeaknessPatternInputs,
  calculatePatternWeakness,
  calculatePatternWeaknessScores,
} from "@/lib/recommendations/weaknessScore";
import type {
  PatternConfusionMetric,
  PatternMetric,
} from "@/lib/analytics/types";
import type { WeaknessPatternInput } from "@/lib/recommendations/types";

function patternInput(
  overrides: Partial<WeaknessPatternInput> = {},
): WeaknessPatternInput {
  return {
    patternId: "arrays-hashing",
    masteryScore: 50,
    recognitionAccuracy: 50,
    solveRate: 50,
    retentionScore: 70,
    mistakeCount: 1,
    lapseCount: 0,
    battleCount: 0,
    battleVictoryCount: 0,
    battlePartialVictoryCount: 0,
    battleDefeatCount: 0,
    daysSincePractice: 3,
    attemptsCount: 4,
    selectedIncorrectlyForOtherCount: 0,
    ...overrides,
  };
}

test("marks patterns with no attempts as unstarted instead of weak", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      attemptsCount: 0,
      masteryScore: 0,
      recognitionAccuracy: 0,
      solveRate: 0,
      daysSincePractice: null,
    }),
  );

  assert.equal(weakness.weaknessScore, 0);
  assert.equal(weakness.severity, "Unstarted");
  assert.equal(weakness.recommendedActionType, "FocusPattern");
  assert.match(weakness.primaryReason, /not been started/i);
});

test("recommends implementation practice when recognition is high but solve rate is low", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      masteryScore: 62,
      recognitionAccuracy: 88,
      solveRate: 30,
      retentionScore: 80,
      mistakeCount: 0,
      lapseCount: 0,
      daysSincePractice: 1,
    }),
  );

  assert.equal(weakness.recommendedActionType, "RetryProblem");
  assert.match(weakness.primaryReason, /implementation/i);
  assert.ok(weakness.weaknessScore > 0);
});

test("recommends recognition drill when recognition is low", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      masteryScore: 45,
      recognitionAccuracy: 42,
      solveRate: 70,
      retentionScore: 82,
    }),
  );

  assert.equal(weakness.recommendedActionType, "FocusPattern");
  assert.match(weakness.primaryReason, /recognition/i);
});

test("recommends review gauntlet when retention is low", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      masteryScore: 64,
      recognitionAccuracy: 78,
      solveRate: 72,
      retentionScore: 45,
      mistakeCount: 2,
      lapseCount: 2,
    }),
  );

  assert.equal(weakness.recommendedActionType, "ReviewGauntlet");
  assert.match(weakness.primaryReason, /retention/i);
});

test("recommends boss battle when mastery and retention are high", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      masteryScore: 86,
      recognitionAccuracy: 88,
      solveRate: 84,
      retentionScore: 90,
      mistakeCount: 0,
      lapseCount: 0,
      battleCount: 0,
      daysSincePractice: 2,
    }),
  );

  assert.equal(weakness.severity, "Low");
  assert.equal(weakness.recommendedActionType, "BossBattle");
  assert.match(weakness.primaryReason, /ready/i);
});

test("recommends contrast drill when this pattern is repeatedly selected incorrectly", () => {
  const weakness = calculatePatternWeakness(
    patternInput({
      selectedIncorrectlyForOtherCount: 3,
      masteryScore: 72,
      recognitionAccuracy: 76,
      solveRate: 76,
      retentionScore: 78,
    }),
  );

  assert.equal(weakness.recommendedActionType, "ContrastDrill");
  assert.match(weakness.primaryReason, /confused/i);
});

test("sorts weakness scores from highest urgency to lowest", () => {
  const [weakest, strongest] = calculatePatternWeaknessScores([
    patternInput({
      patternId: "strong",
      masteryScore: 90,
      recognitionAccuracy: 90,
      solveRate: 90,
      retentionScore: 90,
      mistakeCount: 0,
      lapseCount: 0,
      daysSincePractice: 1,
    }),
    patternInput({
      patternId: "weak",
      masteryScore: 25,
      recognitionAccuracy: 30,
      solveRate: 25,
      retentionScore: 40,
      mistakeCount: 4,
      lapseCount: 3,
      battleDefeatCount: 1,
      daysSincePractice: 18,
    }),
  ]);

  assert.equal(weakest.patternId, "weak");
  assert.equal(strongest.patternId, "strong");
  assert.ok(weakest.weaknessScore > strongest.weaknessScore);
});

test("builds weakness inputs from analytics metrics and confusion counts", () => {
  const patternMetric = {
    patternId: "arrays-hashing",
    patternName: "Arrays & Hashing",
    attemptsCount: 3,
    solvedCount: 1,
    partiallySolvedCount: 1,
    notSolvedCount: 1,
    solveRate: 33,
    recognitionAttempts: 3,
    recognitionCorrect: 2,
    recognitionAccuracy: 67,
    averageConfidence: 3,
    averageAIScore: null,
    mistakeCount: 2,
    flashcardCount: 1,
    reviewCount: 2,
    reviewRatingAverage: 50,
    lapseCount: 1,
    retentionScore: 50,
    battleCount: 2,
    battleVictoryCount: 1,
    lastPracticedAt: "2026-05-20T00:00:00.000Z",
    daysSincePractice: 12,
    masteryScore: 48,
  } satisfies PatternMetric;
  const [input] = buildWeaknessPatternInputs(
    [patternMetric],
    [
      {
        selectedPatternId: "arrays-hashing",
        correctPatternId: "two-pointers",
        count: 2,
        lastSeenAt: "2026-05-31T00:00:00.000Z",
        selectedPatternName: "Arrays & Hashing",
        correctPatternName: "Two Pointers",
      },
    ] satisfies PatternConfusionMetric[],
  );

  assert.equal(input.patternId, "arrays-hashing");
  assert.equal(input.solveRate, 33);
  assert.equal(input.battlePartialVictoryCount, 1);
  assert.equal(input.selectedIncorrectlyForOtherCount, 2);
});
