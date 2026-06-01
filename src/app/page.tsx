"use client";

import { SignUpButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useMemo } from "react";

import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { getGamificationStats, type PatternStanding } from "@/lib/gamification";
import {
  getMasteryLevel,
  getOverallMasteryScore,
  getPatternProgress,
  getProblemCountForPattern,
} from "@/lib/mastery";
import { getAttempts } from "@/lib/progress";
import type { ReviewStats } from "@/lib/review/queue";
import { generateDailySession } from "@/lib/session";
import type { Attempt, PatternProgress, Problem } from "@/lib/types";
import { useAuthProgress } from "@/lib/use-auth-progress";

const DEMO_STATS = [
  { label: "Total XP", value: "0", detail: "Earned by practicing" },
  { label: "Current streak", value: "0", detail: "Attempt or review days" },
  { label: "Problems attempted", value: "0", detail: "Unique problem starts" },
  { label: "Problems solved", value: "0", detail: "Unique solved problems" },
  { label: "Recognition accuracy", value: "0%", detail: "Pattern guesses" },
];

const EMPTY_RECENT_ATTEMPTS = [
  "Pick a problem from Daily Forge.",
  "Guess the pattern before solving.",
  "Save a short reflection to build mastery.",
];

function findProblem(problemId: string): Problem | undefined {
  return problems.find((problem) => problem.id === problemId);
}

function findPatternName(patternId: string): string {
  return (
    patterns.find((pattern) => pattern.id === patternId)?.name ?? "Unknown"
  );
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Home() {
  const { user } = useUser();
  const {
    progress,
    dashboardStats,
    patternProgressById,
    reviewStats,
    isLoading,
    isSignedIn,
  } = useAuthProgress();
  const attempts = useMemo(() => getAttempts(progress), [progress]);
  const stats = useMemo(
    () => dashboardStats ?? getGamificationStats(attempts),
    [attempts, dashboardStats],
  );
  const dailySession = useMemo(() => generateDailySession(attempts), [attempts]);
  const patternRows = useMemo(
    () =>
      patterns.map((pattern) => ({
        pattern,
        progress:
          patternProgressById?.[pattern.id] ??
          getPatternProgress(pattern.id, progress),
        problemCount: getProblemCountForPattern(pattern.id),
      })),
    [patternProgressById, progress],
  );
  const patternsInProgress = patternRows
    .filter((row) => row.progress.attemptedCount > 0)
    .sort(
      (a, b) =>
        b.progress.lastPracticedAt?.localeCompare(
          a.progress.lastPracticedAt ?? "",
        ) ||
        b.progress.attemptedCount - a.progress.attemptedCount ||
        a.pattern.levelOrder - b.pattern.levelOrder,
    )
    .slice(0, 6);
  const recentAttempts = attempts.slice().reverse().slice(0, 5);
  const overallMastery = getOverallMasteryScore(progress);
  const displayName =
    user?.firstName ?? user?.username ?? user?.primaryEmailAddress?.emailAddress;

  if (isLoading) {
    return <LoadingDashboard />;
  }

  if (!isSignedIn) {
    return <UnauthenticatedDashboard />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Account Dashboard
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Welcome{displayName ? `, ${displayName}` : ""}.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Your progress is synced to your PatternForge account. Use today&apos;s
            recommendation to keep the next rep focused.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/forge"
              className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
            >
              Start Daily Forge
            </Link>
            <Link
              href="/patterns"
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              View Pattern Map
            </Link>
          </div>
        </div>

        <RecommendedPatternCard
          pattern={dailySession.recommendedPattern}
          attempts={attempts.length}
          goal={dailySession.goal}
        />
      </section>

      <ReviewDashboardSection reviewStats={reviewStats} />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total XP" value={stats.xp} detail="Account lifetime" />
        <StatCard
          label="Current streak"
          value={stats.currentStreak}
          detail="Attempt or review days"
        />
        <StatCard
          label="Problems attempted"
          value={stats.problemsAttempted}
          detail={`${stats.totalAttempts} total attempts`}
        />
        <StatCard
          label="Problems solved"
          value={stats.problemsSolved}
          detail="Unique solved problems"
        />
        <StatCard
          label="Recognition accuracy"
          value={`${stats.recognitionAccuracy}%`}
          detail="Pattern guesses"
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="space-y-6">
          <PatternStandingPanel
            bestPattern={stats.bestPattern}
            weakestPattern={stats.weakestPattern}
            overallMastery={overallMastery}
          />
          <RecentAttemptsPanel attempts={recentAttempts} />
        </div>

        <PatternsInProgressPanel rows={patternsInProgress} />
      </section>
    </div>
  );
}

function LoadingDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          PatternForge
        </p>
        <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Loading your dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
          Fetching your saved attempts, mastery, XP, and recommendation.
        </p>
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {DEMO_STATS.map((stat) => (
          <div
            key={stat.label}
            className="h-32 animate-pulse rounded-lg border border-slate-200 bg-white shadow-sm"
          />
        ))}
      </section>
    </div>
  );
}

function UnauthenticatedDashboard() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            PatternForge
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Stop grinding randomly. Forge the pattern.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            PatternForge trains recognition before repetition. Sign in to start
            forging patterns with saved attempts, XP, streaks, and pattern
            mastery.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/patterns"
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              View Pattern Map
            </Link>
            <SignUpButton mode="modal">
              <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Demo Dashboard
          </p>
          <h2 className="mt-4 text-2xl font-black tracking-tight">
            Your account starts clean.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            After sign-up, every reflection saves to your private progress
            history and updates this dashboard.
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            {["Recognize", "Solve", "Reflect"].map((step, index) => (
              <div
                key={step}
                className="rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <p className="text-xl font-black text-teal-300">
                  0{index + 1}
                </p>
                <p className="mt-2 text-xs font-bold text-slate-300">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {DEMO_STATS.map((stat) => (
          <StatCard
            key={stat.label}
            label={stat.label}
            value={stat.value}
            detail={stat.detail}
          />
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recent attempts
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            No account history yet
          </h2>
          <div className="mt-5 grid gap-3">
            {EMPTY_RECENT_ATTEMPTS.map((item) => (
              <p
                key={item}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600"
              >
                {item}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Patterns in progress
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Sign up to start tracking
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {patterns.slice(0, 4).map((pattern) => (
              <div
                key={pattern.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <p className="font-black text-slate-950">{pattern.name}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {getProblemCountForPattern(pattern.id)} practice problems
                </p>
                <div className="mt-3">
                  <ProgressBar value={0} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function RecommendedPatternCard({
  pattern,
  attempts,
  goal,
}: {
  pattern: (typeof patterns)[number];
  attempts: number;
  goal: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Today&apos;s recommended pattern
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight">
            {pattern.name}
          </h2>
        </div>
        <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200">
          {attempts === 0 ? "First run" : "Weakest lane"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-300">{goal}</p>
      <div className="mt-5 grid grid-cols-3 gap-3">
        {["Recognize", "Solve", "Reflect"].map((step, index) => (
          <div
            key={step}
            className="rounded-lg border border-white/10 bg-white/5 p-3"
          >
            <p className="text-xl font-black text-teal-300">0{index + 1}</p>
            <p className="mt-2 text-xs font-bold text-slate-300">{step}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewDashboardSection({
  reviewStats,
}: {
  reviewStats: (ReviewStats & { memoryStreak: number }) | null;
}) {
  const hasRetentionData = (reviewStats?.recentReviewCount ?? 0) >= 3;
  const hasAnyReviewData = (reviewStats?.recentReviewCount ?? 0) > 0;
  const retentionValue =
    hasRetentionData && reviewStats?.retentionScore !== null
      ? `${reviewStats?.retentionScore}%`
      : "Not enough reviews yet";
  const weakestReviewTitle =
    reviewStats?.weakestReviewPattern?.patternName ??
    (hasAnyReviewData ? "No weak pattern yet" : "No review history yet");

  return (
    <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr] xl:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Today&apos;s Review
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Spaced repetition queue
            </h2>
          </div>
          <Link
            href="/review"
            className="rounded-lg bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
          >
            Start Daily Review
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          <MiniStat
            label="Flashcards due"
            value={reviewStats?.dueFlashcardsCount ?? 0}
          />
          <MiniStat
            label="Mistakes due"
            value={reviewStats?.dueMistakesCount ?? 0}
          />
          <MiniStat label="Total due" value={reviewStats?.totalDueCount ?? 0} />
          <MiniStat
            label="Reviewed today"
            value={reviewStats?.reviewedTodayCount ?? 0}
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Retention Score
        </p>
        <p className="mt-3 text-2xl font-black leading-tight text-slate-950 sm:text-3xl">
          {retentionValue}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {hasRetentionData
            ? `${reviewStats?.recentReviewCount ?? 0} recent review ratings`
            : "Complete a few reviews to estimate retention."}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Memory Streak
        </p>
        <p className="mt-3 text-4xl font-black">
          {reviewStats?.memoryStreak ?? 0}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
          Consecutive days with a review or attempt.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2 xl:col-span-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Weakest Review Pattern
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              {weakestReviewTitle}
            </h2>
          </div>
          {reviewStats?.weakestReviewPattern ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              {reviewStats.weakestReviewPattern.difficultCount} Again/Hard
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          {reviewStats?.weakestReviewPattern
            ? `${reviewStats.weakestReviewPattern.reviewedCount} recent review ratings, ${reviewStats.weakestReviewPattern.retentionScore}% retention.`
            : hasAnyReviewData
              ? "Recent ratings are holding up. Again and Hard reviews will surface here when a pattern needs attention."
              : "Complete Daily Review sessions to reveal patterns that need another pass."}
        </p>
      </div>
    </section>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function PatternStandingPanel({
  bestPattern,
  weakestPattern,
  overallMastery,
}: {
  bestPattern?: PatternStanding;
  weakestPattern?: PatternStanding;
  overallMastery: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Pattern standing
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Best and weakest
          </h2>
        </div>
        <MasteryBadge
          level={getMasteryLevel(overallMastery)}
          score={overallMastery}
        />
      </div>
      <div className="mt-5 grid gap-3">
        <PatternStandingCard
          label="Best pattern"
          standing={bestPattern}
          emptyText="Log an attempt to reveal your strongest lane."
          tone="teal"
        />
        <PatternStandingCard
          label="Weakest pattern"
          standing={weakestPattern}
          emptyText="Log an attempt to reveal your priority lane."
          tone="amber"
        />
      </div>
    </div>
  );
}

function PatternStandingCard({
  label,
  standing,
  emptyText,
  tone,
}: {
  label: string;
  standing?: PatternStanding;
  emptyText: string;
  tone: "teal" | "amber";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 font-black text-slate-950">
            {standing?.pattern.name ?? "No attempts yet"}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {standing
              ? `${standing.attempts} attempt${standing.attempts === 1 ? "" : "s"}`
              : emptyText}
          </p>
        </div>
        {standing ? (
          <span className="text-sm font-black text-slate-700">
            {standing.masteryScore}%
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <ProgressBar value={standing?.masteryScore ?? 0} tone={tone} />
      </div>
    </div>
  );
}

function RecentAttemptsPanel({ attempts }: { attempts: Attempt[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recent attempts
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Latest saved reps
          </h2>
        </div>
      </div>

      {attempts.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="font-black text-slate-950">No attempts yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Start Daily Forge, complete a reflection, and your saved attempts
            will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {attempts.map((attempt) => {
            const problem = findProblem(attempt.problemId);

            return (
              <Link
                key={`${attempt.problemId}-${attempt.createdAt}`}
                href={`/problems/${attempt.problemId}`}
                className="block bg-white p-4 transition hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-black text-slate-950">
                      {problem?.title ?? attempt.problemId}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {findPatternName(attempt.correctPatternId)} ·{" "}
                      {attempt.solvedStatus}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-xs font-black uppercase tracking-[0.14em] ${
                        attempt.wasPatternCorrect
                          ? "text-teal-700"
                          : "text-amber-700"
                      }`}
                    >
                      {attempt.wasPatternCorrect ? "Recognized" : "Review"}
                    </p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PatternsInProgressPanel({
  rows,
}: {
  rows: {
    pattern: (typeof patterns)[number];
    progress: PatternProgress;
    problemCount: number;
  }[];
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Patterns in progress
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Active mastery lanes
          </h2>
        </div>
        <Link
          href="/patterns"
          className="text-sm font-black text-teal-700 hover:text-teal-900"
        >
          View Pattern Map
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
          <p className="font-black text-slate-950">No patterns in progress</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Your first saved attempt will create a mastery lane here. New users
            start with Arrays & Hashing in Daily Forge.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {rows.map(({ pattern, progress: patternProgress, problemCount }) => (
            <div
              key={pattern.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">{pattern.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {patternProgress.attemptedCount} attempt
                    {patternProgress.attemptedCount === 1 ? "" : "s"} ·{" "}
                    {problemCount} problems
                  </p>
                </div>
                <MasteryBadge
                  level={getMasteryLevel(patternProgress.masteryScore)}
                />
              </div>
              <div className="mt-4">
                <ProgressBar
                  value={patternProgress.masteryScore}
                  label="Mastery"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
