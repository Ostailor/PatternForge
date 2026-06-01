import assert from "node:assert/strict";
import test from "node:test";

import { summarizeBattleCompletion } from "@/lib/battles/completion";

test("summarizeBattleCompletion awards victory for all recognition and solve rounds", () => {
  const summary = summarizeBattleCompletion([
    { wasPatternCorrect: true, solvedStatus: "Solved" },
    { wasPatternCorrect: true, solvedStatus: "Solved" },
    { wasPatternCorrect: true, solvedStatus: "Solved" },
  ]);

  assert.deepEqual(summary, {
    result: "Victory",
    correctRecognitionCount: 3,
    solvedProblemCount: 3,
    partiallySolvedProblemCount: 0,
    xpEarned: 150,
  });
});

test("summarizeBattleCompletion awards partial victory for a majority clear", () => {
  const summary = summarizeBattleCompletion([
    { wasPatternCorrect: true, solvedStatus: "Solved" },
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
  ]);

  assert.equal(summary.result, "PartialVictory");
  assert.equal(summary.xpEarned, 85);
});

test("summarizeBattleCompletion marks defeat below the majority threshold", () => {
  const summary = summarizeBattleCompletion([
    { wasPatternCorrect: true, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
    { wasPatternCorrect: false, solvedStatus: "NotSolved" },
  ]);

  assert.equal(summary.result, "Defeat");
  assert.equal(summary.xpEarned, 35);
});
