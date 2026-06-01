"use client";

import { SignUpButton, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useMemo } from "react";

import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import {
  AchievementToast,
  LevelUpCard,
  QuestCompletedCard,
} from "@/components/completion";
import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { getGamificationStats, type PatternStanding } from "@/lib/gamification";
import {
  getMasteryLevel,
  getMasteryLevelNumber,
  getOverallMasteryScore,
  getPatternProgress,
  getProblemCountForPattern,
  isMasterTier,
} from "@/lib/mastery";
import { getAttempts } from "@/lib/progress";
import type {
  DashboardAchievementPreview,
  DashboardBattleCardData,
  DashboardGamificationData,
} from "@/lib/progress-db";
import type { DailyQuest } from "@/lib/quests/types";
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

const LEVEL_MILESTONES = [
  { score: 1, levelNumber: 1, level: "Warming Up" },
  { score: 26, levelNumber: 2, level: "Apprentice" },
  { score: 51, levelNumber: 3, level: "Forging" },
  { score: 76, levelNumber: 4, level: "Sharp" },
  { score: 91, levelNumber: 5, level: "Mastered" },
] as const;

type PatternDashboardRow = {
  pattern: (typeof patterns)[number];
  progress: PatternProgress;
  problemCount: number;
};

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

function formatBattleType(battleType: string): string {
  switch (battleType) {
    case "PatternBoss":
      return "Pattern Boss";
    case "MixedBattle":
      return "Mixed Battle";
    case "ReviewGauntlet":
      return "Review Gauntlet";
    default:
      return battleType;
  }
}

function getNextLevelInfo(score: number) {
  const nextMilestone = LEVEL_MILESTONES.find(
    (milestone) => score < milestone.score,
  );

  if (!nextMilestone) {
    return null;
  }

  return {
    ...nextMilestone,
    pointsToNext: nextMilestone.score - score,
    progress: Math.min(Math.round((score / nextMilestone.score) * 100), 100),
  };
}

function getEventTone(eventType: string): string {
  switch (eventType) {
    case "AchievementEarned":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "BattleCompleted":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "QuestCompleted":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function Home() {
  const { user } = useUser();
  const {
    progress,
    dashboardStats,
    patternProgressById,
    reviewStats,
    dailyQuests,
    dashboardGamification,
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
  const recommendedPatternProgress =
    patternRows.find(
      (row) => row.pattern.id === dailySession.recommendedPattern.id,
    )?.progress ?? getPatternProgress(dailySession.recommendedPattern.id, progress);
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
          progress={recommendedPatternProgress}
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

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <BossBattleDashboardCard data={dashboardGamification?.battleCard ?? null} />
        <DailyQuestsSection quests={dailyQuests ?? []} />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <RecentGameEventsPanel data={dashboardGamification?.recentGameEvents ?? null} />
        <AchievementsPreviewPanel
          data={dashboardGamification?.achievementsPreview ?? null}
        />
      </section>

      <PatternLevelOverviewPanel rows={patternRows} />

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
  progress,
  attempts,
  goal,
}: {
  pattern: (typeof patterns)[number];
  progress: PatternProgress;
  attempts: number;
  goal: string;
}) {
  const level = getMasteryLevel(progress.masteryScore);
  const levelNumber = getMasteryLevelNumber(progress.masteryScore);

  return (
    <div
      className={`rounded-lg border p-5 text-white shadow-sm ${
        isMasterTier(progress.masteryScore)
          ? "border-indigo-300 bg-indigo-950"
          : "border-slate-200 bg-slate-950"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Today&apos;s recommended pattern
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight">
            {pattern.name}
          </h2>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-300">
            Level {levelNumber} · {level}
          </p>
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

function BossBattleDashboardCard({
  data,
}: {
  data: DashboardBattleCardData | null;
}) {
  const activeBattle = data?.activeBattle ?? null;
  const recommendedBattle = data?.recommendedBattle;
  const title =
    activeBattle?.title ?? recommendedBattle?.title ?? "Pattern Boss Battle";
  const battleType =
    activeBattle?.battleType ?? recommendedBattle?.battleType ?? "PatternBoss";

  return (
    <section className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Boss Battle
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            {activeBattle
              ? `${formatBattleType(activeBattle.battleType)} in progress${
                  activeBattle.targetPatternName
                    ? ` · ${activeBattle.targetPatternName}`
                    : ""
                }`
              : (recommendedBattle?.description ??
                "Start a Pattern Boss when you are ready for pressure.")}
          </p>
        </div>
        <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-200">
          {activeBattle ? "Active" : "Recommended"}
        </span>
      </div>

      {activeBattle ? (
        <div className="mt-5">
          <ProgressBar
            value={activeBattle.progress}
            label={`${activeBattle.completedRounds}/${activeBattle.totalRounds} rounds`}
            tone="indigo"
          />
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Started {formatDate(activeBattle.startedAt)}
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm font-semibold leading-6 text-slate-300">
          {recommendedBattle?.reason ??
            "Pattern Boss is available as soon as a seeded problem exists."}
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        <BattleMiniStat
          label="Type"
          value={formatBattleType(battleType)}
        />
        <BattleMiniStat
          label="Completed"
          value={data?.stats.completed ?? 0}
        />
        <BattleMiniStat label="Victories" value={data?.stats.victories ?? 0} />
        <BattleMiniStat
          label="Avg recog."
          value={`${data?.stats.averageRecognitionAccuracy ?? 0}%`}
        />
      </div>

      <Link
        href={data?.entryHref ?? "/battles"}
        className="mt-5 inline-flex w-full justify-center rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-100"
      >
        {data?.buttonLabel ?? "Enter Battle"}
      </Link>
    </section>
  );
}

function BattleMiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 break-words text-sm font-black text-white">{value}</p>
    </div>
  );
}

function DailyQuestsSection({ quests }: { quests: DailyQuest[] }) {
  const visibleQuests = quests.slice(0, 3);
  const completedCount = quests.filter((quest) => quest.status === "Completed")
    .length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Daily Quests
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Today&apos;s objectives
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {completedCount}/{quests.length} complete
        </span>
      </div>

      {visibleQuests.length === 0 ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Daily quests will appear after your account progress loads.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {visibleQuests.map((quest) => {
            const progress =
              quest.targetCount === 0
                ? 0
                : Math.round((quest.currentCount / quest.targetCount) * 100);
            const isCompleted = quest.status === "Completed";

            return isCompleted ? (
              <QuestCompletedCard
                key={quest.id}
                title={quest.title}
                xpAmount={quest.xpReward}
                description={`Quest complete: ${quest.title}. +${quest.xpReward} XP`}
                nextActionLabel="View Game Events"
                nextActionHref="/"
              />
            ) : (
              <div
                key={quest.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{quest.title}</p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      {quest.description}
                    </p>
                  </div>
                  <span
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600"
                  >
                    +{quest.xpReward} XP
                  </span>
                </div>
                <div className="mt-4">
                  <ProgressBar
                    value={progress}
                    label={`${quest.currentCount}/${quest.targetCount}`}
                    tone="indigo"
                  />
                </div>
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  In progress
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecentGameEventsPanel({
  data,
}: {
  data: DashboardGamificationData["recentGameEvents"] | null;
}) {
  const events = data?.events ?? [];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recent Game Events
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            XP activity
          </h2>
        </div>
        <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
          +{data?.xpEarned ?? 0} XP
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniStat
          label="Achievements"
          value={data?.achievementsEarned ?? 0}
        />
        <MiniStat label="Battles" value={data?.battlesCompleted ?? 0} />
        <MiniStat label="Quests" value={data?.questsCompleted ?? 0} />
      </div>

      {events.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          New XP events will appear here as you complete attempts, reviews,
          quests, battles, and achievements.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200">
          {events.slice(0, 5).map((event) => (
            <div key={event.id} className="bg-white p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-black text-slate-950">{event.title}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {formatDate(event.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${getEventTone(
                      event.eventType,
                    )}`}
                  >
                    +{event.xpAmount} XP
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AchievementsPreviewPanel({
  data,
}: {
  data: DashboardAchievementPreview | null;
}) {
  const recentEarned = data?.recentEarned ?? [];
  const nextBadge = data?.nextBadge ?? null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Achievements
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Badge preview
          </h2>
        </div>
        <Link
          href="/achievements"
          className="text-sm font-black text-teal-700 hover:text-teal-900"
        >
          View all
        </Link>
      </div>

      {recentEarned.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="font-black text-slate-950">No badges earned yet</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            Your first completed attempt can unlock First Forge.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {recentEarned.map((achievement) => (
            <AchievementToast
              key={achievement.id}
              name={achievement.name}
              icon={achievement.icon}
              xpAmount={achievement.xpReward}
              description={achievement.description}
              nextActionLabel="Open Achievements"
              nextActionHref="/achievements"
            />
          ))}
        </div>
      )}

      <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
          Next badge
        </p>
        {nextBadge ? (
          <AchievementPreviewRow achievement={nextBadge} locked />
        ) : (
          <p className="mt-2 text-sm font-bold text-amber-900">
            All current badges earned.
          </p>
        )}
      </div>
    </section>
  );
}

function AchievementPreviewRow({
  achievement,
  earnedAt,
  locked = false,
}: {
  achievement: {
    icon: string;
    name: string;
    description: string;
    xpReward: number;
  };
  earnedAt?: string;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-xs font-black ${
          locked
            ? "border-amber-200 bg-white text-amber-700"
            : "border-teal-200 bg-teal-50 text-teal-700"
        }`}
      >
        {achievement.icon}
      </div>
      <div className="min-w-0">
        <p className="font-black text-slate-950">{achievement.name}</p>
        <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
          {achievement.description}
        </p>
        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          +{achievement.xpReward} XP
          {earnedAt ? ` · ${formatDate(earnedAt)}` : ""}
        </p>
      </div>
    </div>
  );
}

function PatternLevelOverviewPanel({ rows }: { rows: PatternDashboardRow[] }) {
  const topPatterns = rows
    .slice()
    .sort(
      (a, b) =>
        b.progress.masteryScore - a.progress.masteryScore ||
        b.progress.attemptedCount - a.progress.attemptedCount ||
        a.pattern.levelOrder - b.pattern.levelOrder,
    )
    .slice(0, 3);
  const closeToLeveling = rows
    .map((row) => ({
      ...row,
      nextLevel: getNextLevelInfo(row.progress.masteryScore),
    }))
    .filter(
      (
        row,
      ): row is PatternDashboardRow & {
        nextLevel: NonNullable<ReturnType<typeof getNextLevelInfo>>;
      } => row.progress.attemptedCount > 0 && row.nextLevel !== null,
    )
    .sort(
      (a, b) =>
        a.nextLevel.pointsToNext - b.nextLevel.pointsToNext ||
        b.progress.masteryScore - a.progress.masteryScore,
    )
    .slice(0, 3);

  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Pattern Levels
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Mastery progression
          </h2>
        </div>
        <Link
          href="/patterns"
          className="text-sm font-black text-teal-700 hover:text-teal-900"
        >
          View Pattern Map
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Top mastery
          </p>
          <div className="mt-3 grid gap-3">
            {topPatterns.map((row) => (
              <PatternLevelRow key={row.pattern.id} row={row} />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Close to leveling up
          </p>
          {closeToLeveling.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
              Save attempts to reveal patterns near the next level.
            </p>
          ) : (
            <div className="mt-3 grid gap-3">
              {closeToLeveling.map((row) => (
                <LevelUpCard
                  key={row.pattern.id}
                  patternName={row.pattern.name}
                  levelName={row.nextLevel.level}
                  levelNumber={row.nextLevel.levelNumber}
                  isLevelUp={false}
                  description={`${row.nextLevel.pointsToNext} mastery point${
                    row.nextLevel.pointsToNext === 1 ? "" : "s"
                  } from the next pattern level.`}
                  nextActionLabel="Practice This Pattern"
                  nextActionHref={`/forge?pattern=${row.pattern.id}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function PatternLevelRow({
  row,
}: {
  row: PatternDashboardRow;
}) {
  const level = getMasteryLevel(row.progress.masteryScore);
  const levelNumber = getMasteryLevelNumber(row.progress.masteryScore);
  const masterTier = isMasterTier(row.progress.masteryScore);

  return (
    <div
      className={`rounded-lg border p-4 ${
        masterTier ? "border-indigo-200 bg-indigo-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-slate-950">{row.pattern.name}</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {row.progress.attemptedCount} attempt
            {row.progress.attemptedCount === 1 ? "" : "s"} · {row.problemCount}{" "}
            problems
          </p>
        </div>
        <MasteryBadge
          level={level}
          levelNumber={levelNumber}
          score={row.progress.masteryScore}
        />
      </div>
      <div className="mt-3">
        <ProgressBar
          value={row.progress.masteryScore}
          label="Mastery"
          tone={masterTier ? "indigo" : "teal"}
        />
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
  const overallLevel = getMasteryLevel(overallMastery);
  const overallLevelNumber = getMasteryLevelNumber(overallMastery);

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
          level={overallLevel}
          levelNumber={overallLevelNumber}
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
  const level = standing ? getMasteryLevel(standing.masteryScore) : null;
  const levelNumber = standing
    ? getMasteryLevelNumber(standing.masteryScore)
    : null;
  const masterTier = standing ? isMasterTier(standing.masteryScore) : false;

  return (
    <div
      className={`rounded-lg border p-4 ${
        masterTier
          ? "border-indigo-200 bg-indigo-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
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
          {level && levelNumber !== null ? (
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Level {levelNumber} · {level}
            </p>
          ) : null}
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
          {rows.map(({ pattern, progress: patternProgress, problemCount }) => {
            const level = getMasteryLevel(patternProgress.masteryScore);
            const levelNumber = getMasteryLevelNumber(
              patternProgress.masteryScore,
            );
            const masterTier = isMasterTier(patternProgress.masteryScore);

            return (
              <div
                key={pattern.id}
                className={`rounded-lg border p-4 ${
                  masterTier
                    ? "border-indigo-200 bg-indigo-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{pattern.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {patternProgress.attemptedCount} attempt
                      {patternProgress.attemptedCount === 1 ? "" : "s"} ·{" "}
                      {problemCount} problems
                    </p>
                    <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Level {levelNumber} · {level}
                    </p>
                  </div>
                  <MasteryBadge level={level} levelNumber={levelNumber} />
                </div>
                <div className="mt-4">
                  <ProgressBar
                    value={patternProgress.masteryScore}
                    label="Mastery"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
