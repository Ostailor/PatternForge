import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCurrentStreak,
  calculateReviewXp,
  getGamificationStats,
} from "@/lib/gamification";
import type { Attempt } from "@/lib/types";

function attempt(createdAt: string): Attempt {
  return {
    id: createdAt,
    problemId: "two-sum",
    selectedPatternId: "arrays-hashing",
    correctPatternId: "arrays-hashing",
    wasPatternCorrect: true,
    solvedStatus: "Solved",
    timeSpentMinutes: 15,
    confidence: 4,
    reflection: "Used a complement lookup and explained the invariant clearly.",
    createdAt,
  };
}

test("calculateReviewXp applies v0.4 review rewards", () => {
  assert.equal(
    calculateReviewXp({
      itemType: "Flashcard",
      rating: "Good",
      reviewedAt: "2026-06-01T12:00:00.000Z",
    }),
    10,
  );
  assert.equal(
    calculateReviewXp({
      itemType: "Mistake",
      rating: "Easy",
      reviewedAt: "2026-06-01T12:00:00.000Z",
      mistakeHadPriorLapse: true,
    }),
    15,
  );
});

test("calculateCurrentStreak counts attempts and reviews", () => {
  assert.equal(
    calculateCurrentStreak(
      [attempt("2026-05-30T12:00:00.000Z")],
      [
        {
          itemType: "Flashcard",
          rating: "Good",
          reviewedAt: "2026-05-31T12:00:00.000Z",
        },
        {
          itemType: "Mistake",
          rating: "Hard",
          reviewedAt: "2026-06-01T12:00:00.000Z",
        },
      ],
    ),
    3,
  );
});

test("getGamificationStats includes review XP without clear-due bonus", () => {
  const stats = getGamificationStats([attempt("2026-06-01T12:00:00.000Z")], {
    reviewActivities: [
      {
        itemType: "Flashcard",
        rating: "Easy",
        reviewedAt: "2026-06-01T13:00:00.000Z",
      },
    ],
    clearedDueReviewsToday: true,
  });

  assert.equal(stats.xp, 55);
  assert.equal(stats.currentStreak, 1);
});
