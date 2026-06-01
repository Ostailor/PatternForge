"use client";

import { useMemo } from "react";

import { patterns } from "@/data/patterns";
import { useAuthProgress } from "@/lib/use-auth-progress";
import { getPatternStats, summarizeSession } from "@/lib/mastery";
import SessionSummary from "./SessionSummary";

export default function ProgressSnapshot() {
  const { progress, isSignedIn } = useAuthProgress();

  const attempts = useMemo(
    () => Object.values(progress.attempts),
    [progress.attempts],
  );
  const summary = summarizeSession(attempts);
  const strongestPattern = patterns
    .map((pattern) => ({
      pattern,
      solved: getPatternStats(pattern.id, progress).solved,
    }))
    .sort((a, b) => b.solved - a.solved)[0];

  return (
    <section className="space-y-4">
      <SessionSummary summary={summary} />
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {isSignedIn ? "Account profile" : "Signed-out profile"}
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div>
            <p
              className="text-2xl font-black text-slate-950"
              suppressHydrationWarning
            >
              {progress.streak}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              practice streak
            </p>
          </div>
          <div>
            <p
              className="text-2xl font-black text-slate-950"
              suppressHydrationWarning
            >
              {attempts.length}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              logged reflections
            </p>
          </div>
          <div>
            <p
              className="text-2xl font-black text-slate-950"
              suppressHydrationWarning
            >
              {strongestPattern?.pattern.name ?? "None"}
            </p>
            <p className="text-sm font-semibold text-slate-500">
              strongest pattern
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
