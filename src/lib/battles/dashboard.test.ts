import assert from "node:assert/strict";
import test from "node:test";

import {
  canStartPatternBoss,
  isMixedBattleRecommended,
  isReviewGauntletRecommended,
  summarizeBattleStats,
} from "@/lib/battles/dashboard";

test("summarizeBattleStats calculates completed counts, recognition accuracy, and best boss pattern", () => {
  const stats = summarizeBattleStats([
    {
      battleType: "PatternBoss",
      result: "Victory",
      targetPatternName: "Arrays & Hashing",
      rounds: [
        { wasPatternCorrect: true },
        { wasPatternCorrect: true },
        { wasPatternCorrect: false },
      ],
    },
    {
      battleType: "PatternBoss",
      result: "Victory",
      targetPatternName: "Arrays & Hashing",
      rounds: [{ wasPatternCorrect: true }],
    },
    {
      battleType: "MixedBattle",
      result: "PartialVictory",
      targetPatternName: null,
      rounds: [
        { wasPatternCorrect: false },
        { wasPatternCorrect: null },
      ],
    },
  ]);

  assert.deepEqual(stats, {
    battlesCompleted: 3,
    victories: 2,
    partialVictories: 1,
    averageRecognitionAccuracy: 60,
    bestBossPattern: "Arrays & Hashing",
  });
});

test("battle readiness helpers use soft recommendations", () => {
  assert.equal(canStartPatternBoss(0), false);
  assert.equal(canStartPatternBoss(1), true);
  assert.equal(isMixedBattleRecommended(4), false);
  assert.equal(isMixedBattleRecommended(5), true);
  assert.equal(isReviewGauntletRecommended(2), false);
  assert.equal(isReviewGauntletRecommended(3), true);
});
