import { SignInButton } from "@clerk/nextjs";

import DailyReviewClient from "@/app/review/review-client";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import {
  getRecentReviewHistory,
  getReviewQueue,
  getReviewStats,
} from "@/lib/review/queue";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export default async function ReviewPage() {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedReviewPage />;
  }

  const [queue, stats, recentHistory] = await Promise.all([
    getReviewQueue(userProfile.id),
    getReviewStats(userProfile.id),
    getRecentReviewHistory(userProfile.id),
  ]);

  await trackEvent({
    eventName: AnalyticsEvents.DailyReviewStarted,
    userProfileId: userProfile.id,
    properties: {
      queueCount: queue.length,
      dueFlashcardsCount: stats.dueFlashcardsCount,
      dueMistakesCount: stats.dueMistakesCount,
      reviewedTodayCount: stats.reviewedTodayCount,
    },
  });

  return (
    <DailyReviewClient
      initialQueue={queue.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        patternId: item.patternId,
        patternName: item.patternName,
        problemTitle: item.problemTitle,
        prompt: item.prompt,
        answer: item.answer,
        reviewDueAt: item.reviewDueAt.toISOString(),
        intervalDays: item.intervalDays,
        lapses: item.lapses,
      }))}
      stats={{
        dueFlashcardsCount: stats.dueFlashcardsCount,
        dueMistakesCount: stats.dueMistakesCount,
        totalDueCount: stats.totalDueCount,
        reviewedTodayCount: stats.reviewedTodayCount,
        retentionScore: stats.retentionScore,
        weakestReviewPattern: stats.weakestReviewPattern
          ? {
              patternId: stats.weakestReviewPattern.patternId,
              patternName: stats.weakestReviewPattern.patternName,
              retentionScore: stats.weakestReviewPattern.retentionScore,
            }
          : null,
      }}
      recentHistory={recentHistory.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        rating: item.rating,
        reviewedAt: item.reviewedAt.toISOString(),
        patternName: item.patternName,
        problemTitle: item.problemTitle,
      }))}
    />
  );
}

function UnauthenticatedReviewPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Daily Review
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Sign in to review
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Spaced repetition flashcards and mistake reviews are saved to your
          PatternForge account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
