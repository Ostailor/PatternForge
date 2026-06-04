"use server";

import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export async function trackDailyForgeStartedAction(input: {
  focusPatternId?: string;
  stepCount: number;
  problemCount: number;
  estimatedMinutes: number;
  reviewOnlyStepCount: number;
}) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  await trackEvent({
    eventName: AnalyticsEvents.DailyForgeStarted,
    userProfileId: userProfile.id,
    properties: {
      focusPatternId: input.focusPatternId,
      stepCount: input.stepCount,
      problemCount: input.problemCount,
      estimatedMinutes: input.estimatedMinutes,
      reviewOnlyStepCount: input.reviewOnlyStepCount,
    },
  });
}
