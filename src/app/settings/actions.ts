"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CurrentLevel,
  PreferredSessionLength,
  PrimaryGoal,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(formData: FormData, key: string): boolean {
  return readString(formData, key) === "true";
}

function readDailyGoalMinutes(formData: FormData): number {
  const value = Number(readString(formData, "dailyGoalMinutes"));

  return Number.isInteger(value) && value >= 5 && value <= 180 ? value : 25;
}

function readTargetInterviewDate(formData: FormData): Date | null {
  const value = readString(formData, "targetInterviewDate");

  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readEnumValue<T extends Record<string, string>>(
  enumObject: T,
  value: string,
  fallback: T[keyof T],
): T[keyof T] {
  return Object.values(enumObject).includes(value) ? (value as T[keyof T]) : fallback;
}

function redirectToSettings(status: string): never {
  redirect(`/settings?status=${encodeURIComponent(status)}`);
}

function revalidateAccountDataPaths() {
  revalidatePath("/settings");
  revalidatePath("/");
  revalidatePath("/readiness");
  revalidatePath("/code/history");
  revalidatePath("/interviews");
  revalidatePath("/plans");
  revalidatePath("/review");
  revalidatePath("/flashcards");
  revalidatePath("/mistakes");
  revalidatePath("/achievements");
  revalidatePath("/battles");
}

export async function updateProfilePreferencesAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  await getPrisma().userSettings.upsert({
    where: { userProfileId: userProfile.id },
    update: {
      preferredLanguage: "Python",
      dailyGoalMinutes: readDailyGoalMinutes(formData),
      targetInterviewDate: readTargetInterviewDate(formData),
      currentLevel: readEnumValue(
        CurrentLevel,
        readString(formData, "currentLevel"),
        CurrentLevel.Beginner,
      ),
      primaryGoal: readEnumValue(
        PrimaryGoal,
        readString(formData, "primaryGoal"),
        PrimaryGoal.LearnPatterns,
      ),
      preferredSessionLength: readEnumValue(
        PreferredSessionLength,
        readString(formData, "preferredSessionLength"),
        PreferredSessionLength.Medium25,
      ),
    },
    create: {
      userProfileId: userProfile.id,
      preferredLanguage: "Python",
      dailyGoalMinutes: readDailyGoalMinutes(formData),
      targetInterviewDate: readTargetInterviewDate(formData),
      currentLevel: readEnumValue(
        CurrentLevel,
        readString(formData, "currentLevel"),
        CurrentLevel.Beginner,
      ),
      primaryGoal: readEnumValue(
        PrimaryGoal,
        readString(formData, "primaryGoal"),
        PrimaryGoal.LearnPatterns,
      ),
      preferredSessionLength: readEnumValue(
        PreferredSessionLength,
        readString(formData, "preferredSessionLength"),
        PreferredSessionLength.Medium25,
      ),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  redirectToSettings("preferences-saved");
}

export async function updateAiAndVoiceSettingsAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  await getPrisma().userSettings.upsert({
    where: { userProfileId: userProfile.id },
    update: {
      voiceModeEnabled: readBoolean(formData, "voiceModeEnabled"),
      interviewerSpeechEnabled: readBoolean(formData, "interviewerSpeechEnabled"),
      storeVoiceTranscripts: readBoolean(formData, "storeVoiceTranscripts"),
      storeRawAudio: readBoolean(formData, "storeRawAudio"),
      analyticsOptOut: readBoolean(formData, "analyticsOptOut"),
    },
    create: {
      userProfileId: userProfile.id,
      voiceModeEnabled: readBoolean(formData, "voiceModeEnabled"),
      interviewerSpeechEnabled: readBoolean(formData, "interviewerSpeechEnabled"),
      storeVoiceTranscripts: readBoolean(formData, "storeVoiceTranscripts"),
      storeRawAudio: readBoolean(formData, "storeRawAudio"),
      analyticsOptOut: readBoolean(formData, "analyticsOptOut"),
    },
  });

  revalidatePath("/settings");
  redirectToSettings("privacy-saved");
}

export async function deleteAllVoiceTranscriptsAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  if (readString(formData, "confirmation") !== "DELETE VOICE") {
    redirectToSettings("confirm-voice");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.communicationInsight.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.voiceFeedback.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.voiceTurn.deleteMany({
      where: {
        interviewSession: {
          userProfileId: userProfile.id,
        },
      },
    });
    await tx.voiceSession.updateMany({
      where: { userProfileId: userProfile.id },
      data: {
        status: "Abandoned",
        completedAt: new Date(),
      },
    });
    await tx.interviewSession.updateMany({
      where: { userProfileId: userProfile.id },
      data: { communicationScore: null },
    });
  });

  revalidatePath("/settings");
  revalidatePath("/readiness");
  revalidatePath("/interviews");
  redirectToSettings("voice-deleted");
}

export async function deleteCodeSubmissionsAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  if (readString(formData, "confirmation") !== "DELETE CODE") {
    redirectToSettings("confirm-code");
  }

  await getPrisma().codeSubmission.deleteMany({
    where: { userProfileId: userProfile.id },
  });

  revalidatePath("/settings");
  revalidatePath("/code/history");
  revalidatePath("/readiness");
  redirectToSettings("code-deleted");
}

export async function deleteAiReviewsAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  if (readString(formData, "confirmation") !== "DELETE AI") {
    redirectToSettings("confirm-ai");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.interviewRound.updateMany({
      where: {
        interviewSession: {
          userProfileId: userProfile.id,
        },
      },
      data: { aiReviewId: null },
    });
    await tx.aIReview.deleteMany({
      where: { userProfileId: userProfile.id },
    });
  });

  revalidateAccountDataPaths();
  redirectToSettings("ai-deleted");
}

export async function resetLearningProgressAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirectToSettings("signin");
  }

  if (readString(formData, "confirmation") !== "RESET PROGRESS") {
    redirectToSettings("confirm-reset");
  }

  await getPrisma().$transaction(async (tx) => {
    await tx.recommendationFeedback.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.recommendation.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.communicationInsight.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.voiceFeedback.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.voiceTurn.deleteMany({
      where: {
        interviewSession: {
          userProfileId: userProfile.id,
        },
      },
    });
    await tx.voiceSession.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.debugInsight.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.codeSubmission.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.interviewSession.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.battle.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.reviewLog.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.mistake.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.flashcard.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.aIReview.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.attempt.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.quest.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.userAchievement.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.gameEvent.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.patternInsight.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.patternConfusion.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.learningPlan.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.diagnosticAssessment.deleteMany({
      where: { userProfileId: userProfile.id },
    });
    await tx.userGoal.deleteMany({
      where: { userProfileId: userProfile.id },
    });
  });

  revalidateAccountDataPaths();
  redirectToSettings("progress-reset");
}
