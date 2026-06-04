"use server";

import { FeedbackType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit/rateLimit";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_PAGE_PATH_LENGTH = 320;

export type SubmitFeedbackInput = {
  feedbackType: FeedbackType;
  pagePath: string;
  message: string;
  rating?: number;
  appVersion?: string;
};

export type SubmitFeedbackResult =
  | { status: "saved" }
  | { status: "invalid"; message: string };

function isFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === "string" &&
    Object.values(FeedbackType).includes(value as FeedbackType)
  );
}

function normalizePagePath(pagePath: string) {
  const trimmed = pagePath.trim();

  if (!trimmed.startsWith("/")) {
    return "/";
  }

  return trimmed.slice(0, MAX_PAGE_PATH_LENGTH);
}

function normalizeRating(rating: unknown): number | undefined {
  if (rating === undefined || rating === null || rating === "") {
    return undefined;
  }

  const value = Number(rating);

  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : undefined;
}

function getAppVersion(inputVersion: string | undefined) {
  return (
    process.env.NEXT_PUBLIC_PATTERNFORGE_VERSION ??
    process.env.PATTERNFORGE_VERSION ??
    inputVersion?.trim() ??
    "0.0.0"
  );
}

export async function submitFeedbackAction(
  input: SubmitFeedbackInput,
): Promise<SubmitFeedbackResult> {
  if (!getFeatureFlag("betaFeedback")) {
    return {
      status: "invalid",
      message: "Beta feedback is temporarily unavailable.",
    };
  }

  if (!input || typeof input !== "object") {
    return { status: "invalid", message: "Feedback payload is invalid." };
  }

  if (!isFeedbackType(input.feedbackType)) {
    return { status: "invalid", message: "Choose a feedback type." };
  }

  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (message.length < 8) {
    return {
      status: "invalid",
      message: "Add a little more detail before submitting.",
    };
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      status: "invalid",
      message: `Keep feedback under ${MAX_MESSAGE_LENGTH.toLocaleString()} characters.`,
    };
  }

  const userProfile = await ensureCurrentUserProfile();
  const rateLimit = await checkRateLimit({
    kind: "feedback",
    userProfileId: userProfile?.id ?? null,
    fallbackKey: "anonymous-feedback",
  });

  if (!rateLimit.ok) {
    return { status: "invalid", message: rateLimit.message };
  }

  const rating = normalizeRating(input.rating);
  const pagePath = normalizePagePath(input.pagePath);
  const appVersion = getAppVersion(input.appVersion);

  await getPrisma().userFeedback.create({
    data: {
      userProfileId: userProfile?.id ?? null,
      feedbackType: input.feedbackType,
      pagePath,
      message,
      rating,
      metadata: {
        appVersion,
        authenticated: Boolean(userProfile),
      } satisfies Prisma.InputJsonObject,
    },
  });

  await trackEvent({
    eventName: AnalyticsEvents.FeedbackSubmitted,
    userProfileId: userProfile?.id ?? null,
    properties: {
      feedbackType: input.feedbackType,
      pagePath,
      rating,
      authenticated: Boolean(userProfile),
      appVersion,
    },
  });

  return { status: "saved" };
}
