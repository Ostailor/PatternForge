import assert from "node:assert/strict";
import test from "node:test";

import { calculateInterviewRewards } from "@/lib/interviews/rewards";

test("calculateInterviewRewards applies interview XP rules once per summary", () => {
  const rewards = calculateInterviewRewards({
    overallScore: 88,
    testingScore: 86,
    complexityScore: 90,
    result: "StrongHire",
    previousOverallScore: 65,
    rounds: [
      {
        selectedPatternId: "sliding-window",
        correctPatternId: "sliding-window",
        patternExplanation:
          "The fixed-size window signal appears because each step maintains a bounded contiguous range.",
        approachText:
          "Maintain a window invariant, update counts as the right pointer moves, and shrink when constraints break.",
        codeText: "function solve(input) { return input.length; }",
        testCasesText:
          "Empty input, one element, duplicate values, boundary-sized window, and a case that forces repeated shrinking.",
        complexityText: "O(n) time because each pointer moves once; O(k) space for counts.",
      },
    ],
  });

  assert.deepEqual(rewards.breakdown, {
    completedInterview: 40,
    completedAllPhases: 20,
    correctPatternRecognition: 25,
    scoreAtLeast70: 25,
    meaningfulTests: 15,
    correctComplexity: 15,
  });
  assert.equal(rewards.completedXp, 140);
  assert.equal(rewards.strongResultXp, 50);
  assert.equal(rewards.strongResult, true);
  assert.equal(rewards.improvedBy, 23);
  assert.equal(rewards.improvedByAtLeast20, true);
});
