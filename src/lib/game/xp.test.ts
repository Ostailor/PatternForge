import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateAchievementXp,
  calculateAttemptXp,
  calculateBattleXp,
  calculateQuestXp,
  calculateReviewXp,
} from "@/lib/game/xp";
import type { Attempt } from "@/lib/types";

const solvedAttempt: Attempt = {
  id: "attempt-1",
  problemId: "two-sum",
  selectedPatternId: "arrays-hashing",
  correctPatternId: "arrays-hashing",
  wasPatternCorrect: true,
  solvedStatus: "Solved",
  timeSpentMinutes: 12,
  confidence: 4,
  reflection: "I recognized the complement lookup and explained the invariant.",
  createdAt: "2026-06-01T12:00:00.000Z",
};

test("calculateAttemptXp applies v0.4 attempt rewards", () => {
  assert.equal(calculateAttemptXp(solvedAttempt), 40);
  assert.equal(
    calculateAttemptXp({
      ...solvedAttempt,
      wasPatternCorrect: false,
      solvedStatus: "Partially Solved",
      reflection: "Short",
    }),
    15,
  );
});

test("calculateReviewXp applies v0.4 review rewards", () => {
  assert.equal(
    calculateReviewXp({
      itemType: "Flashcard",
      rating: "Good",
    }),
    10,
  );
  assert.equal(
    calculateReviewXp({
      itemType: "Mistake",
      rating: "Easy",
    }),
    15,
  );
});

test("calculateBattleXp applies completion, result, recognition, and solve rewards", () => {
  assert.equal(
    calculateBattleXp({
      result: "Victory",
      correctRecognitionCount: 2,
      solvedProblemCount: 1,
      partiallySolvedProblemCount: 1,
    }),
    118,
  );
  assert.equal(
    calculateBattleXp({
      result: "PartialVictory",
      correctRecognitionCount: 1,
      solvedProblemCount: 0,
    }),
    60,
  );
  assert.equal(
    calculateBattleXp({
      result: "Defeat",
      correctRecognitionCount: 0,
      solvedProblemCount: 0,
    }),
    25,
  );
});

test("quest and achievement XP use configured rewards", () => {
  assert.equal(calculateQuestXp({ xpReward: 30 }), 30);
  assert.equal(calculateAchievementXp({ xpReward: 75 }), 75);
});
