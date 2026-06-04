"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { patterns } from "@/data/patterns";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import {
  generateFocusedPatternInterview,
  generateMixedInterview,
  generateSingleProblemInterview,
  generateWeaknessRepairInterview,
} from "@/lib/interviews/generateInterview";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const STARTER_PATTERN_ID = "arrays-hashing";

function redirectToInterviews(params?: Record<string, string>): never {
  if (!params) {
    redirect("/interviews");
  }

  const searchParams = new URLSearchParams(params);

  redirect(`/interviews?${searchParams.toString()}`);
}

function redirectToInterview(interviewId: string): never {
  redirect(`/interviews/${interviewId}`);
}

function readPatternId(formData: FormData): string {
  const patternId = formData.get("patternId");

  return typeof patternId === "string" ? patternId.trim() : "";
}

function getValidPatternId(patternId: string): string {
  return patterns.some((pattern) => pattern.id === patternId)
    ? patternId
    : STARTER_PATTERN_ID;
}

async function getExistingActiveInterviewId(userProfileId: string) {
  const activeInterview = await getPrisma().interviewSession.findFirst({
    where: {
      userProfileId,
      status: "Active",
    },
    select: {
      id: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  return activeInterview?.id ?? null;
}

async function ensureCanStartInterview(userProfileId: string): Promise<boolean> {
  return (await getExistingActiveInterviewId(userProfileId)) === null;
}

export async function startSingleProblemInterviewAction() {
  if (!getFeatureFlag("interviews")) {
    redirectToInterviews({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToInterviews({ error: "signin" });
  }

  if (!(await ensureCanStartInterview(userProfile.id))) {
    redirectToInterviews();
  }

  let interviewId: string;

  try {
    const interview = await generateSingleProblemInterview(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.InterviewStarted,
      userProfileId: userProfile.id,
      properties: {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        durationMinutes: interview.durationMinutes,
        roundCount: interview.rounds.length,
      },
    });
    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startFocusedInterviewAction(formData: FormData) {
  if (!getFeatureFlag("interviews")) {
    redirectToInterviews({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToInterviews({ error: "signin" });
  }

  if (!(await ensureCanStartInterview(userProfile.id))) {
    redirectToInterviews();
  }

  let interviewId: string;

  try {
    const interview = await generateFocusedPatternInterview(
      userProfile.id,
      getValidPatternId(readPatternId(formData)),
    );

    await trackEvent({
      eventName: AnalyticsEvents.InterviewStarted,
      userProfileId: userProfile.id,
      properties: {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        targetPatternId: interview.targetPatternId ?? undefined,
        durationMinutes: interview.durationMinutes,
        roundCount: interview.rounds.length,
      },
    });
    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startMixedInterviewAction() {
  if (!getFeatureFlag("interviews")) {
    redirectToInterviews({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToInterviews({ error: "signin" });
  }

  if (!(await ensureCanStartInterview(userProfile.id))) {
    redirectToInterviews();
  }

  let interviewId: string;

  try {
    const interview = await generateMixedInterview(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.InterviewStarted,
      userProfileId: userProfile.id,
      properties: {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        durationMinutes: interview.durationMinutes,
        roundCount: interview.rounds.length,
      },
    });
    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startWeaknessRepairInterviewAction() {
  if (!getFeatureFlag("interviews")) {
    redirectToInterviews({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToInterviews({ error: "signin" });
  }

  if (!(await ensureCanStartInterview(userProfile.id))) {
    redirectToInterviews();
  }

  let interviewId: string;

  try {
    const interview = await generateWeaknessRepairInterview(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.InterviewStarted,
      userProfileId: userProfile.id,
      properties: {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        targetPatternId: interview.targetPatternId ?? undefined,
        durationMinutes: interview.durationMinutes,
        roundCount: interview.rounds.length,
      },
    });
    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}
