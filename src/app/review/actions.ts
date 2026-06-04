"use server";

import { revalidatePath } from "next/cache";

import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import {
  getReviewStats,
  ReviewItemAccessError,
  ReviewValidationError,
  submitFlashcardReview,
  submitMistakeReview,
} from "@/lib/review/queue";
import type { ReviewItemType, ReviewRating } from "@/lib/review/types";
import { isReviewRating, reviewItemTypes } from "@/lib/review/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type SubmitReviewInput = {
  itemType: ReviewItemType;
  itemId: string;
  rating: ReviewRating;
};

export type SubmitReviewResult =
  | {
      status: "saved";
      nextReviewDueAt: string;
      nextIntervalDays: number;
      remainingDueCount: number;
    }
  | { status: "unauthenticated" }
  | { status: "forbidden"; message: string }
  | { status: "invalid"; message: string };

function isReviewItemType(value: string): value is ReviewItemType {
  return reviewItemTypes.includes(value as ReviewItemType);
}

function validateInput(input: SubmitReviewInput): string | null {
  if (!input.itemId?.trim()) {
    return "Review item ID is required.";
  }

  if (!isReviewItemType(input.itemType)) {
    return "Review item type is invalid.";
  }

  if (!isReviewRating(input.rating)) {
    return "Review rating is invalid.";
  }

  return null;
}

export async function submitReviewAction(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  const validationError = validateInput(input);

  if (validationError) {
    return { status: "invalid", message: validationError };
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated" };
  }

  try {
    const result =
      input.itemType === "Flashcard"
        ? await submitFlashcardReview(
            userProfile.id,
            input.itemId,
            input.rating,
          )
        : await submitMistakeReview(userProfile.id, input.itemId, input.rating);
    const reviewStats = await getReviewStats(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.DailyReviewCompleted,
      userProfileId: userProfile.id,
      properties: {
        itemType: input.itemType,
        rating: input.rating,
        nextIntervalDays: result.nextIntervalDays,
        remainingDueCount: reviewStats.totalDueCount,
      },
    });

    revalidatePath("/review");
    revalidatePath("/");

    return {
      status: "saved",
      nextReviewDueAt: result.nextReviewDueAt.toISOString(),
      nextIntervalDays: result.nextIntervalDays,
      remainingDueCount: reviewStats.totalDueCount,
    };
  } catch (error) {
    if (error instanceof ReviewItemAccessError) {
      return {
        status: "forbidden",
        message: "This review item is not available for the current user.",
      };
    }

    if (error instanceof ReviewValidationError) {
      return { status: "invalid", message: error.message };
    }

    return {
      status: "invalid",
      message: "Review could not be saved.",
    };
  }
}
