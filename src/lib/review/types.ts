export const reviewRatings = ["Again", "Hard", "Good", "Easy"] as const;

export type ReviewRating = (typeof reviewRatings)[number];

export function isReviewRating(value: string): value is ReviewRating {
  return reviewRatings.includes(value as ReviewRating);
}

export const reviewItemTypes = ["Flashcard", "Mistake"] as const;

export type ReviewItemType = (typeof reviewItemTypes)[number];

export type ReviewScheduleState = {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  lapses: number;
};

export type CalculateNextReviewInput = ReviewScheduleState & {
  rating: ReviewRating;
  reviewedAt: Date;
};

export type NextReviewSchedule = {
  nextIntervalDays: number;
  nextEaseFactor: number;
  nextRepetitions: number;
  nextLapses: number;
  nextReviewDueAt: Date;
};
