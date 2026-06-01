import assert from "node:assert/strict";
import test from "node:test";

import { calculateNextReview } from "@/lib/review/scheduler";
import type { ReviewRating } from "@/lib/review/types";

const reviewedAt = new Date("2026-06-01T12:00:00.000Z");

function dueDateAfter(days: number): Date {
  return new Date(reviewedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

test("calculateNextReview applies each v0.3 rating rule", () => {
  const cases: {
    rating: ReviewRating;
    nextIntervalDays: number;
    nextEaseFactor: number;
    nextRepetitions: number;
    nextLapses: number;
  }[] = [
    {
      rating: "Again",
      nextIntervalDays: 1,
      nextEaseFactor: 2.3,
      nextRepetitions: 0,
      nextLapses: 2,
    },
    {
      rating: "Hard",
      nextIntervalDays: 5,
      nextEaseFactor: 2.4,
      nextRepetitions: 4,
      nextLapses: 1,
    },
    {
      rating: "Good",
      nextIntervalDays: 10,
      nextEaseFactor: 2.5,
      nextRepetitions: 4,
      nextLapses: 1,
    },
    {
      rating: "Easy",
      nextIntervalDays: 13,
      nextEaseFactor: 2.65,
      nextRepetitions: 4,
      nextLapses: 1,
    },
  ];

  for (const expected of cases) {
    const {
      rating,
      nextIntervalDays,
      nextEaseFactor,
      nextRepetitions,
      nextLapses,
    } = expected;

    assert.deepEqual(
      calculateNextReview({
        intervalDays: 4,
        easeFactor: 2.5,
        repetitions: 3,
        lapses: 1,
        rating,
        reviewedAt,
      }),
      {
        nextIntervalDays,
        nextEaseFactor,
        nextRepetitions,
        nextLapses,
        nextReviewDueAt: dueDateAfter(nextIntervalDays),
      },
    );
  }
});

test("calculateNextReview uses first-review intervals when intervalDays is zero", () => {
  const cases: [ReviewRating, number][] = [
    ["Again", 1],
    ["Hard", 2],
    ["Good", 3],
    ["Easy", 5],
  ];

  for (const [rating, nextIntervalDays] of cases) {
    const result = calculateNextReview({
      intervalDays: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lapses: 0,
      rating,
      reviewedAt,
    });

    assert.equal(result.nextIntervalDays, nextIntervalDays);
    assert.deepEqual(result.nextReviewDueAt, dueDateAfter(nextIntervalDays));
  }
});

test("calculateNextReview clamps easeFactor at the minimum", () => {
  const again = calculateNextReview({
    intervalDays: 6,
    easeFactor: 1.35,
    repetitions: 2,
    lapses: 0,
    rating: "Again",
    reviewedAt,
  });
  const hard = calculateNextReview({
    intervalDays: 6,
    easeFactor: 1.35,
    repetitions: 2,
    lapses: 0,
    rating: "Hard",
    reviewedAt,
  });

  assert.equal(again.nextEaseFactor, 1.3);
  assert.equal(hard.nextEaseFactor, 1.3);
});
