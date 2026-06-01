import type {
  CalculateNextReviewInput,
  NextReviewSchedule,
} from "@/lib/review/types";

const MIN_EASE_FACTOR = 1.3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function clampEaseFactor(easeFactor: number): number {
  return Math.max(MIN_EASE_FACTOR, Number(easeFactor.toFixed(2)));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_IN_MS);
}

export function calculateNextReview({
  intervalDays,
  easeFactor,
  repetitions,
  lapses,
  rating,
  reviewedAt,
}: CalculateNextReviewInput): NextReviewSchedule {
  let nextIntervalDays: number;
  let nextEaseFactor = easeFactor;
  let nextRepetitions = repetitions + 1;
  let nextLapses = lapses;

  switch (rating) {
    case "Again":
      nextIntervalDays = 1;
      nextEaseFactor = clampEaseFactor(easeFactor - 0.2);
      nextRepetitions = 0;
      nextLapses = lapses + 1;
      break;
    case "Hard":
      nextIntervalDays =
        intervalDays === 0 ? 2 : Math.max(2, Math.round(intervalDays * 1.2));
      nextEaseFactor = clampEaseFactor(easeFactor - 0.1);
      break;
    case "Good":
      nextIntervalDays =
        intervalDays === 0
          ? 3
          : Math.max(3, Math.round(intervalDays * easeFactor));
      break;
    case "Easy":
      nextIntervalDays =
        intervalDays === 0
          ? 5
          : Math.max(5, Math.round(intervalDays * easeFactor * 1.3));
      nextEaseFactor = Number((easeFactor + 0.15).toFixed(2));
      break;
  }

  return {
    nextIntervalDays,
    nextEaseFactor,
    nextRepetitions,
    nextLapses,
    nextReviewDueAt: addDays(reviewedAt, nextIntervalDays),
  };
}
