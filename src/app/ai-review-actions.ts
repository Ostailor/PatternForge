"use server";

import {
  AIReviewAttemptAccessError,
  AIReviewDailyLimitError,
  createCurrentUserAIReview,
} from "@/lib/ai-review-db";
import { DAILY_AI_REVIEW_LIMIT } from "@/lib/ai-review-limits";
import {
  AIConfigurationError,
  AIResponseError,
  AIResponseParseError,
} from "@/lib/ai/errors";
import type { SavedAIReview } from "@/lib/ai/types";

const MAX_USER_CODE_LENGTH = 20000;
const MAX_USER_EXPLANATION_LENGTH = 8000;

export type RequestAIReviewInput = {
  attemptId: string;
  userCode: string;
  userExplanation: string;
};

export type RequestAIReviewResult =
  | { status: "saved"; review: SavedAIReview }
  | { status: "unauthenticated" }
  | { status: "forbidden"; message: string }
  | { status: "invalid"; message: string }
  | { status: "rate_limited"; message: string }
  | { status: "ai_error"; message: string };

function validateAIReviewInput(input: RequestAIReviewInput): string | null {
  if (!input.attemptId.trim()) {
    return "Attempt ID is required.";
  }

  if (input.userCode.length > MAX_USER_CODE_LENGTH) {
    return `Code is too long for one AI review. Keep it under ${MAX_USER_CODE_LENGTH.toLocaleString()} characters.`;
  }

  if (input.userExplanation.length > MAX_USER_EXPLANATION_LENGTH) {
    return `Explanation is too long for one AI review. Keep it under ${MAX_USER_EXPLANATION_LENGTH.toLocaleString()} characters.`;
  }

  return null;
}

export async function requestAIReviewAction(
  input: RequestAIReviewInput,
): Promise<RequestAIReviewResult> {
  const validationError = validateAIReviewInput(input);

  if (validationError) {
    return { status: "invalid", message: validationError };
  }

  try {
    const review = await createCurrentUserAIReview({
      attemptId: input.attemptId,
      userCode: input.userCode.trim(),
      userExplanation: input.userExplanation.trim(),
    });

    if (!review) {
      return { status: "unauthenticated" };
    }

    return { status: "saved", review };
  } catch (error) {
    if (error instanceof AIReviewAttemptAccessError) {
      return {
        status: "forbidden",
        message: "This attempt could not be reviewed for the current user.",
      };
    }

    if (error instanceof AIReviewDailyLimitError) {
      return {
        status: "rate_limited",
        message: `Daily Coach Review limit reached. You can run ${DAILY_AI_REVIEW_LIMIT} AI reviews per day.`,
      };
    }

    if (error instanceof AIConfigurationError) {
      return { status: "ai_error", message: error.message };
    }

    if (
      error instanceof AIResponseError ||
      error instanceof AIResponseParseError
    ) {
      return {
        status: "ai_error",
        message: "AI Coach could not return a valid review. Try again later.",
      };
    }

    return {
      status: "ai_error",
      message: "AI Coach review failed. Try again later.",
    };
  }
}
