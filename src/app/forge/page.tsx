"use client";

import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { generateDailySession } from "@/lib/session";
import { getAttempts } from "@/lib/progress";
import type { DailyForgeProblem, DailyForgeSession } from "@/lib/session";
import type { Problem } from "@/lib/types";
import { useAuthProgress } from "@/lib/use-auth-progress";

const difficultyStyles: Record<Problem["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

const typeStyles: Record<DailyForgeProblem["type"], string> = {
  "Warm-up": "border-sky-200 bg-sky-50 text-sky-700",
  "Main Forge": "border-slate-300 bg-slate-950 text-white",
  "Mixed Review": "border-violet-200 bg-violet-50 text-violet-700",
};

export default function ForgePage() {
  const { progress, isSignedIn, isLoading } = useAuthProgress();
  const [session, setSession] = useState<DailyForgeSession>(() =>
    generateDailySession([]),
  );

  useEffect(() => {
    const focusPatternId = new URLSearchParams(window.location.search).get(
      "pattern",
    );
    const attempts = isSignedIn ? getAttempts(progress) : [];

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(
      generateDailySession(attempts, focusPatternId ?? undefined),
    );
  }, [isSignedIn, progress]);

  const firstProblem = session.problems[0]?.problem;
  const estimatedLabel = useMemo(
    () =>
      session.estimatedTotalMinutes >= 60
        ? `${Math.round(session.estimatedTotalMinutes / 5) * 5} min`
        : `${session.estimatedTotalMinutes} min`,
    [session.estimatedTotalMinutes],
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-slate-950 text-white shadow-sm">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
              Daily Forge
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Today&apos;s Forge Session
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
              {session.goal}
            </p>
            <p className="mt-4 text-sm font-semibold text-slate-400">
              {isSignedIn
                ? "PatternForge trains recognition before repetition."
                : "Sign in before reflection to save these reps."}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              {firstProblem ? (
                <Link
                  href={`/problems/${firstProblem.id}`}
                  className="rounded-lg bg-teal-400 px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-teal-300"
                >
                  Start Warm-up
                </Link>
              ) : null}
              <Link
                href="/patterns"
                className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-white/10"
              >
                View Pattern Map
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Session load
              </p>
              <p className="mt-3 text-3xl font-black">{estimatedLabel}</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Problems
              </p>
              <p className="mt-3 text-3xl font-black">
                {session.problems.length}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Pattern mode
              </p>
              <p className="mt-3 text-lg font-black text-teal-300">
                {isLoading ? "Loading" : "Hidden until quiz"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {!isSignedIn ? (
        <section className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
            Save forge results
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-amber-900">
            You can inspect the session and open problems while signed out, but
            attempts are saved only after sign-in.
          </p>
          <SignInButton mode="modal">
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700">
              Sign in
            </button>
          </SignInButton>
        </section>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-3">
        {session.problems.map((item, index) => (
          <ForgeProblemCard key={`${item.type}-${item.problem.id}`} item={item} index={index} />
        ))}
      </section>
    </main>
  );
}

function ForgeProblemCard({
  item,
  index,
}: {
  item: DailyForgeProblem;
  index: number;
}) {
  return (
    <article className="flex min-h-[360px] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span
            className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-black ${typeStyles[item.type]}`}
          >
            {item.type}
          </span>
          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-slate-400">
            Rep 0{index + 1}
          </p>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-bold ${difficultyStyles[item.problem.difficulty]}`}
        >
          {item.problem.difficulty}
        </span>
      </div>

      <div className="mt-5">
        <h2 className="text-xl font-black tracking-tight text-slate-950">
          {item.problem.title}
        </h2>
        <p className="mt-2 text-sm font-semibold text-slate-500">
          {item.problem.estimatedMinutes} min estimated
        </p>
      </div>

      <div className="mt-5">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Recognition clues
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {item.problem.recognitionClues.slice(0, 3).map((clue) => (
            <span
              key={clue}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
            >
              {clue}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto pt-6">
        <div className="mb-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
          Pattern hidden until the recognition quiz.
        </div>
        <Link
          href={`/problems/${item.problem.id}`}
          className="inline-flex w-full justify-center rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Practice Problem
        </Link>
      </div>
    </article>
  );
}
