import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
import { redirect } from "next/navigation";

import {
  CurrentLevel,
  OnboardingStatus,
  PrimaryGoal,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import OnboardingClient from "./onboarding-client";

export default async function OnboardingPage() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return <UnauthenticatedOnboardingPage />;
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedOnboardingPage />;
  }

  const onboardingState = await getPrisma().onboardingState.findUnique({
    where: { userProfileId: userProfile.id },
    select: { status: true },
  });

  if (onboardingState?.status === OnboardingStatus.Completed) {
    redirect("/");
  }

  const userSettings = await getPrisma().userSettings.findUnique({
    where: { userProfileId: userProfile.id },
    select: {
      primaryGoal: true,
      currentLevel: true,
      dailyGoalMinutes: true,
      voiceModeEnabled: true,
    },
  });

  return (
    <OnboardingClient
      initialPrimaryGoal={userSettings?.primaryGoal ?? PrimaryGoal.LearnPatterns}
      initialCurrentLevel={userSettings?.currentLevel ?? CurrentLevel.Beginner}
      initialDailyGoalMinutes={userSettings?.dailyGoalMinutes ?? 25}
      initialVoiceModeEnabled={userSettings?.voiceModeEnabled ?? false}
    />
  );
}

function UnauthenticatedOnboardingPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          PatternForge setup
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to configure PatternForge
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Onboarding saves your goals, practice preferences, and diagnostic
          choice to your private account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
