import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateConsecutiveDayStreak,
  calculateMemoryStreak,
} from "@/lib/memory-streak";
import type { Attempt } from "@/lib/types";

function attempt(createdAt: string): Attempt {
  return {
    id: createdAt,
    problemId: "two-sum",
    selectedPatternId: "arrays-hashing",
    correctPatternId: "arrays-hashing",
    wasPatternCorrect: true,
    solvedStatus: "Solved",
    timeSpentMinutes: 20,
    confidence: 4,
    reflection: "Reviewed the pattern.",
    createdAt,
  };
}

test("calculateConsecutiveDayStreak counts the latest continuous date run", () => {
  assert.equal(
    calculateConsecutiveDayStreak([
      "2026-05-27",
      "2026-05-30",
      "2026-05-31",
      "2026-06-01",
    ]),
    3,
  );
});

test("calculateMemoryStreak combines attempt and review activity days", () => {
  assert.equal(
    calculateMemoryStreak({
      attempts: [attempt("2026-05-30T15:00:00.000Z")],
      reviewDates: [
        new Date("2026-05-31T12:00:00.000Z"),
        new Date("2026-06-01T12:00:00.000Z"),
      ],
    }),
    3,
  );
});
