"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { patterns } from "@/data/patterns";
import {
  generateFocusedPatternInterview,
  generateMixedInterview,
  generateSingleProblemInterview,
  generateWeaknessRepairInterview,
} from "@/lib/interviews/generateInterview";
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

    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startFocusedInterviewAction(formData: FormData) {
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

    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startMixedInterviewAction() {
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

    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}

export async function startWeaknessRepairInterviewAction() {
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

    interviewId = interview.id;
  } catch {
    redirectToInterviews({ error: "unavailable" });
  }

  revalidatePath("/interviews");
  redirectToInterview(interviewId);
}
