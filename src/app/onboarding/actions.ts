"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CurrentLevel,
  DiagnosticStatus,
  OnboardingStatus,
  PreferredSessionLength,
  PrimaryGoal,
  UserGoalStatus,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { ensureStartingPathForUser } from "@/lib/learning-plans/startingPath";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const DEFAULT_TIMEZONE = "UTC";

const primaryGoalTitles: Record<PrimaryGoal, string> = {
  [PrimaryGoal.LearnPatterns]: "Learn coding interview patterns from scratch",
  [PrimaryGoal.PrepareForInternships]: "Prepare for internship interviews",
  [PrimaryGoal.PrepareForNewGrad]: "Prepare for new grad interviews",
  [PrimaryGoal.PrepareForBigTech]: "Prepare for Big Tech interviews",
  [PrimaryGoal.MaintainSkills]: "Stay sharp with regular practice",
  [PrimaryGoal.ImproveInterviewCommunication]:
    "Improve interview communication",
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string): boolean {
  return readString(formData, key) === "true";
}

function readPrimaryGoal(formData: FormData): PrimaryGoal {
  const value = readString(formData, "primaryGoal");

  return Object.values(PrimaryGoal).includes(value as PrimaryGoal)
    ? (value as PrimaryGoal)
    : PrimaryGoal.LearnPatterns;
}

function readCurrentLevel(formData: FormData): CurrentLevel {
  const value = readString(formData, "currentLevel");

  return Object.values(CurrentLevel).includes(value as CurrentLevel)
    ? (value as CurrentLevel)
    : CurrentLevel.Beginner;
}

function readDailyGoalMinutes(formData: FormData): 10 | 25 | 45 {
  const value = Number(readString(formData, "dailyGoalMinutes"));

  return value === 10 || value === 45 ? value : 25;
}

function getPreferredSessionLength(
  dailyGoalMinutes: 10 | 25 | 45,
): PreferredSessionLength {
  switch (dailyGoalMinutes) {
    case 10:
      return PreferredSessionLength.Short10;
    case 45:
      return PreferredSessionLength.Long45;
    case 25:
      return PreferredSessionLength.Medium25;
  }
}

function readTimezone(formData: FormData): string {
  const timezone = readString(formData, "timezone");

  return timezone || DEFAULT_TIMEZONE;
}

async function upsertActiveUserGoal({
  client,
  userProfileId,
  primaryGoal,
}: {
  client: Prisma.TransactionClient;
  userProfileId: string;
  primaryGoal: PrimaryGoal;
}) {
  const existingGoal = await client.userGoal.findFirst({
    where: {
      userProfileId,
      goalType: primaryGoal,
      status: UserGoalStatus.Active,
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existingGoal) {
    await client.userGoal.update({
      where: { id: existingGoal.id },
      data: {
        title: primaryGoalTitles[primaryGoal],
        targetDate: null,
      },
    });
    return;
  }

  await client.userGoal.create({
    data: {
      userProfileId,
      goalType: primaryGoal,
      title: primaryGoalTitles[primaryGoal],
      status: UserGoalStatus.Active,
    },
  });
}

async function upsertDiagnosticChoice({
  client,
  userProfileId,
  wantsDiagnostic,
}: {
  client: Prisma.TransactionClient;
  userProfileId: string;
  wantsDiagnostic: boolean;
}) {
  const existingAssessment = await client.diagnosticAssessment.findFirst({
    where: { userProfileId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  const status = wantsDiagnostic
    ? DiagnosticStatus.InProgress
    : DiagnosticStatus.Skipped;

  if (existingAssessment) {
    await client.diagnosticAssessment.update({
      where: { id: existingAssessment.id },
      data: {
        status,
        startedAt: new Date(),
        completedAt: null,
      },
    });
    return;
  }

  await client.diagnosticAssessment.create({
    data: {
      userProfileId,
      status,
    },
  });
}

export async function completeOnboardingAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/");
  }

  const primaryGoal = readPrimaryGoal(formData);
  const currentLevel = readCurrentLevel(formData);
  const dailyGoalMinutes = readDailyGoalMinutes(formData);
  const wantsDiagnostic = readString(formData, "diagnosticChoice") === "take";
  const now = new Date();

  await getPrisma().$transaction(async (client) => {
    await client.userSettings.upsert({
      where: { userProfileId: userProfile.id },
      update: {
        preferredLanguage: "Python",
        timezone: readTimezone(formData),
        dailyGoalMinutes,
        currentLevel,
        primaryGoal,
        preferredSessionLength: getPreferredSessionLength(dailyGoalMinutes),
        voiceModeEnabled: readBoolean(formData, "voiceModeEnabled"),
        interviewerSpeechEnabled: readBoolean(
          formData,
          "interviewerSpeechEnabled",
        ),
      },
      create: {
        userProfileId: userProfile.id,
        preferredLanguage: "Python",
        timezone: readTimezone(formData),
        dailyGoalMinutes,
        currentLevel,
        primaryGoal,
        preferredSessionLength: getPreferredSessionLength(dailyGoalMinutes),
        voiceModeEnabled: readBoolean(formData, "voiceModeEnabled"),
        interviewerSpeechEnabled: readBoolean(
          formData,
          "interviewerSpeechEnabled",
        ),
      },
    });

    await client.onboardingState.upsert({
      where: { userProfileId: userProfile.id },
      update: {
        status: OnboardingStatus.Completed,
        currentStep: "finish",
        completedAt: now,
        skippedAt: null,
      },
      create: {
        userProfileId: userProfile.id,
        status: OnboardingStatus.Completed,
        currentStep: "finish",
        completedAt: now,
      },
    });

    await upsertActiveUserGoal({
      client,
      userProfileId: userProfile.id,
      primaryGoal,
    });
    await upsertDiagnosticChoice({
      client,
      userProfileId: userProfile.id,
      wantsDiagnostic,
    });

    if (!wantsDiagnostic) {
      await ensureStartingPathForUser({
        client,
        userProfileId: userProfile.id,
        refreshExisting: true,
      });
    }
  });

  await trackEvent({
    eventName: AnalyticsEvents.OnboardingCompleted,
    userProfileId: userProfile.id,
    properties: {
      primaryGoal,
      currentLevel,
      dailyGoalMinutes,
      preferredSessionLength: getPreferredSessionLength(dailyGoalMinutes),
      voiceModeEnabled: readBoolean(formData, "voiceModeEnabled"),
      diagnosticChoice: wantsDiagnostic ? "take" : "skip",
    },
  });

  if (wantsDiagnostic) {
    await trackEvent({
      eventName: AnalyticsEvents.DiagnosticStarted,
      userProfileId: userProfile.id,
      properties: {
        source: "onboarding",
      },
    });
  }

  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect(wantsDiagnostic ? "/onboarding/diagnostic" : "/");
}

export async function trackOnboardingStartedAction() {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  await trackEvent({
    eventName: AnalyticsEvents.OnboardingStarted,
    userProfileId: userProfile.id,
  });
}

export async function skipOnboardingAction() {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/");
  }

  const now = new Date();

  await getPrisma().onboardingState.upsert({
    where: { userProfileId: userProfile.id },
    update: {
      status: OnboardingStatus.Skipped,
      currentStep: "skipped",
      skippedAt: now,
    },
    create: {
      userProfileId: userProfile.id,
      status: OnboardingStatus.Skipped,
      currentStep: "skipped",
      skippedAt: now,
    },
  });

  revalidatePath("/");
  revalidatePath("/onboarding");
  redirect("/");
}
