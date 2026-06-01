"use client";

import { SignInButton } from "@clerk/nextjs";
import { useMemo } from "react";

import PatternCard from "@/components/PatternCard";
import { patterns } from "@/data/patterns";
import {
  getMasteryLevel,
  getPatternProgress,
  getProblemCountForPattern,
} from "@/lib/mastery";
import { useAuthProgress } from "@/lib/use-auth-progress";

export default function PatternsPage() {
  const { progress, patternProgressById, isSignedIn } = useAuthProgress();

  const patternRows = useMemo(
    () =>
      patterns.map((pattern) => {
        const patternProgress =
          patternProgressById?.[pattern.id] ??
          getPatternProgress(pattern.id, progress);

        return {
          pattern,
          progress: patternProgress,
          problemCount: getProblemCountForPattern(pattern.id),
        };
      }),
    [patternProgressById, progress],
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Pattern Map
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Forge every pattern lane
          </h1>
          <p className="mt-3 text-base leading-7 text-slate-600">
            Each card combines seeded problem coverage with authenticated
            recognition and solve attempts.
          </p>
          {!isSignedIn ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">
                Sign in to show your saved mastery and progress on this map.
              </p>
              <SignInButton mode="modal">
                <button className="mt-3 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700">
                  Sign in
                </button>
              </SignInButton>
            </div>
          ) : null}
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Total patterns
          </p>
          <p className="mt-1 text-2xl font-black text-slate-950">
            {patterns.length}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {patternRows.map(({ pattern, progress: patternProgress, problemCount }) => (
          <PatternCard
            key={pattern.id}
            pattern={pattern}
            masteryLevel={getMasteryLevel(patternProgress.masteryScore)}
            progress={patternProgress.masteryScore}
            problemCount={problemCount}
            recognitionClueCount={2}
            showProgress={isSignedIn}
          />
        ))}
      </div>
    </section>
  );
}
