import assert from "node:assert/strict";
import test from "node:test";

import { scoreBattle } from "@/lib/battles/scoreBattle";

test("scoreBattle returns victory at 80 percent recognition and solve completion", () => {
  const score = scoreBattle([
    { wasPatternCorrect: true, solvedStatus: "Solved" },
    { wasPatternCorrect: true, solvedStatus: "PartiallySolved" },
    { wasPatternCorrect: true, solvedStatus: "Solved" },
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "Solved" },
  ]);

  assert.equal(score.result, "Victory");
  assert.equal(score.recognitionAccuracy, 0.8);
  assert.equal(score.solvedRoundCount, 3);
  assert.equal(score.partiallySolvedRoundCount, 1);
  assert.equal(score.completedOrPartialCount, 4);
  assert.equal(score.xpEarned, 168);
});

test("scoreBattle returns partial victory when either threshold reaches 50 percent", () => {
  const score = scoreBattle([
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "Partially Solved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
  ]);

  assert.equal(score.result, "PartialVictory");
  assert.equal(score.recognitionAccuracy, 0.5);
  assert.equal(score.completedOrPartialCount, 1);
  assert.equal(score.xpEarned, 78);
});

test("scoreBattle returns defeat below partial-victory thresholds", () => {
  const score = scoreBattle([
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
  ]);

  assert.equal(score.result, "Defeat");
  assert.equal(score.xpEarned, 35);
});
