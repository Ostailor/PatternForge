import { strict as assert } from "node:assert";

import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { createEmptyProgress, mergeAttempt } from "./progress";
import {
  calculateConfidenceScore,
  calculateMasteryLevel,
  calculateMasteryScore,
  calculateRetentionScore,
  summarizeSession,
} from "./mastery";
import type { Attempt } from "./types";

const solvedAttempt: Attempt = {
  id: "attempt-test",
  problemId: "two-sum",
  selectedPatternId: "arrays-hashing",
  correctPatternId: "arrays-hashing",
  wasPatternCorrect: true,
  solvedStatus: "Solved",
  timeSpentMinutes: 12,
  confidence: 4,
  reflection: "Complement lookup signal.",
  createdAt: "2026-05-31T12:00:00.000Z",
};

const progress = mergeAttempt(createEmptyProgress(), solvedAttempt);

assert.equal(progress.attempts["two-sum"].wasPatternCorrect, true);
assert.equal(calculateMasteryLevel({ solved: 4, attempted: 5, recognized: 4 }), "Sharp");
assert.equal(calculateMasteryScore([]), 0);
assert.equal(
  calculateMasteryScore({
    attempts: [
      {
        ...solvedAttempt,
        solvedStatus: "Not Solved",
        confidence: 3,
      },
    ],
    explanationScores: [8],
    retentionRatings: ["Good"],
  }),
  67,
);
assert.equal(
  calculateMasteryScore([
    {
      ...solvedAttempt,
      solvedStatus: "Not Solved",
      confidence: 3,
    },
  ]),
  58,
);
assert.equal(calculateRetentionScore(["Again", "Hard", "Good", "Easy"]), 59);
assert.equal(calculateConfidenceScore([{ ...solvedAttempt, confidence: 1 }]), 0);
assert.equal(calculateConfidenceScore([{ ...solvedAttempt, confidence: 5 }]), 100);
assert.deepEqual(summarizeSession([solvedAttempt]), {
  attempted: 1,
  solved: 1,
  averageConfidence: 4,
});

assert.equal(patterns.length, 12);
assert.ok(problems.length >= 30);
assert.ok(problems.every((problem) => problem.url.startsWith("https://leetcode.com/problems/")));
assert.ok(
  problems.every((problem) =>
    patterns.some((pattern) => pattern.id === problem.primaryPatternId),
  ),
);
