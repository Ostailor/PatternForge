import {
  isReviewRating,
  type ReviewItemType,
  type ReviewRating,
  type ReviewScheduleState,
} from "@/lib/review/types";

export type ReviewQueueItem = ReviewScheduleState & {
  id: string;
  itemType: ReviewItemType;
  patternId: string;
  patternName: string;
  problemTitle: string | null;
  prompt: string;
  answer: string;
  reviewDueAt: Date;
  lastReviewedAt: Date | null;
  status: string;
};

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewValidationError";
  }
}

export function requireNonEmpty(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ReviewValidationError(message);
  }

  return trimmed;
}

export function validateReviewRequest(
  userProfileId: string,
  itemId: string,
  rating: string,
): ReviewRating {
  requireNonEmpty(userProfileId, "User profile ID is required.");
  requireNonEmpty(itemId, "Review item ID is required.");

  if (!isReviewRating(rating)) {
    throw new ReviewValidationError("Review rating is invalid.");
  }

  return rating;
}

export function getRatingValue(rating: ReviewRating): number {
  switch (rating) {
    case "Again":
      return 0;
    case "Hard":
      return 50;
    case "Good":
      return 85;
    case "Easy":
      return 100;
  }
}

export function toRetentionScore(ratings: ReviewRating[]): number | null {
  if (ratings.length === 0) {
    return null;
  }

  const total = ratings.reduce(
    (sum, rating) => sum + getRatingValue(rating),
    0,
  );

  return Math.round(total / ratings.length);
}

export function sortReviewQueueItems(
  items: ReviewQueueItem[],
): ReviewQueueItem[] {
  return items.slice().sort((a, b) => {
    const dueDelta = a.reviewDueAt.getTime() - b.reviewDueAt.getTime();

    if (dueDelta !== 0) {
      return dueDelta;
    }

    return a.itemType.localeCompare(b.itemType);
  });
}
