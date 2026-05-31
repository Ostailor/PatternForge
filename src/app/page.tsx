"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import { getGamificationStats } from "@/lib/gamification";
import {
  getMasteryLevel,
  getOverallMasteryScore,
  getPatternProgress,
  getProblemCountForPattern,
} from "@/lib/mastery";
import {
  clearAttempts,
  createEmptyProgress,
  getAttempts,
  loadProgress,
  subscribeToProgress,
} from "@/lib/progress";
import type { UserProgress } from "@/lib/types";

export default function Home() {
  const [progress, setProgress] = useState<UserProgress>(createEmptyProgress);

  useEffect(() => {
    // localStorage is the temporary data source for v0.0.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadProgress());

    return subscribeToProgress(() => setProgress(loadProgress()));
  }, []);

  const attempts = useMemo(() => getAttempts(progress), [progress]);
  const stats = useMemo(() => getGamificationStats(attempts), [attempts]);
  const patternRows = useMemo(
    () =>
      patterns.map((pattern) => {
        const patternProgress = getPatternProgress(pattern.id, progress);

        return {
          pattern,
          progress: patternProgress,
          problemCount: getProblemCountForPattern(pattern.id),
        };
      }),
    [progress],
  );
  const overallMastery = getOverallMasteryScore(progress);

  function handleResetProgress() {
    clearAttempts();
    setProgress(loadProgress());
  }

  const statCards = [
    { label: "Total XP", value: stats.xp, detail: "local score" },
    { label: "Current streak", value: stats.currentStreak, detail: "practice dates" },
    {
      label: "Problems attempted",
      value: stats.problemsAttempted,
      detail: `${stats.totalAttempts} total attempts`,
    },
    { label: "Problems solved", value: stats.problemsSolved, detail: "unique solves" },
    {
      label: "Recognition accuracy",
      value: `${stats.recognitionAccuracy}%`,
      detail: "pattern guesses",
    },
    {
      label: "Mastered patterns",
      value: stats.masteredPatternsCount,
      detail: `${patterns.length} total lanes`,
    },
  ];

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
            Train recognition, solve with intent, and turn interview practice
            into a repeatable mastery loop.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
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

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
                Today&apos;s Forge Session
              </p>
              <h2 className="mt-4 text-2xl font-black tracking-tight">
                3 focused reps
              </h2>
            </div>
            <span className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200">
              Local-only
            </span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Recognize the pattern, open the official problem link, then log the
            result in your browser.
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

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-black text-slate-950">
              {stat.value}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {stat.detail}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Pattern standing
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Best and weakest lanes
              </h2>
            </div>
            <MasteryBadge level={getMasteryLevel(overallMastery)} score={overallMastery} />
          </div>
          <div className="mt-5 grid gap-3">
            <PatternStandingCard
              label="Best pattern"
              standing={stats.bestPattern}
              emptyText="Log an attempt to reveal your strongest lane."
              tone="teal"
            />
            <PatternStandingCard
              label="Weakest pattern"
              standing={stats.weakestPattern}
              emptyText="Log an attempt to reveal your priority lane."
              tone="amber"
            />
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Mastery map
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Pattern levels
              </h2>
            </div>
            <Link
              href="/patterns"
              className="text-sm font-black text-teal-700 hover:text-teal-900"
            >
              View Pattern Map
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {patternRows.slice(0, 6).map(({ pattern, progress: patternProgress }) => (
              <div
                key={pattern.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-black text-slate-950">{pattern.name}</p>
                  <MasteryBadge
                    level={getMasteryLevel(patternProgress.masteryScore)}
                  />
                </div>
                <div className="mt-3">
                  <ProgressBar value={patternProgress.masteryScore} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Local testing
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Progress is stored only in this browser.
          </p>
        </div>
        <button
          type="button"
          onClick={handleResetProgress}
          className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-black text-rose-700 transition hover:bg-rose-100"
        >
          Reset Local Progress
        </button>
      </footer>
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
  standing: ReturnType<typeof getGamificationStats>["bestPattern"];
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
