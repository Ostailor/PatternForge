import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateOverallRubricScore,
  clampInterviewScore,
  getDifficultyOrderForReadiness,
  getReadinessTier,
} from "@/lib/interviews/scoring";

test("clampInterviewScore normalizes invalid and boundary scores", () => {
  assert.equal(clampInterviewScore(Number.NaN), 0);
  assert.equal(clampInterviewScore(-12), 0);
  assert.equal(clampInterviewScore(101.2), 100);
  assert.equal(clampInterviewScore(74.6), 75);
});

test("getReadinessTier maps readiness scores to low, medium, and high", () => {
  assert.equal(getReadinessTier(44), "Low");
  assert.equal(getReadinessTier(45), "Medium");
  assert.equal(getReadinessTier(69), "Medium");
  assert.equal(getReadinessTier(70), "High");
});

test("getDifficultyOrderForReadiness prefers explicit target first", () => {
  assert.deepEqual(getDifficultyOrderForReadiness(30), [
    "Easy",
    "Medium",
    "Hard",
  ]);
  assert.deepEqual(getDifficultyOrderForReadiness(55), [
    "Medium",
    "Easy",
    "Hard",
  ]);
  assert.deepEqual(getDifficultyOrderForReadiness(80, "Hard"), [
    "Hard",
    "Medium",
    "Easy",
  ]);
});

test("calculateOverallRubricScore applies configured category weights", () => {
  assert.equal(
    calculateOverallRubricScore({
      Communication: 80,
      PatternRecognition: 70,
      ProblemSolving: 90,
      Implementation: 60,
      Testing: 50,
      Complexity: 100,
      TimeManagement: 80,
    }),
    76,
  );

  assert.equal(
    calculateOverallRubricScore({
      Communication: 100,
    }),
    15,
  );
});
