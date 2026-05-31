"use client";

import { useEffect, useMemo, useState } from "react";

import { patterns } from "@/data/patterns";
import {
  createEmptyProgress,
  loadProgress,
  subscribeToProgress,
} from "@/lib/progress";
import type { UserProgress } from "@/lib/types";
import { getPatternStats, summarizeSession } from "@/lib/mastery";
import SessionSummary from "./SessionSummary";

export default function ProgressSnapshot() {
  const [progress, setProgress] = useState<UserProgress>(createEmptyProgress);

  useEffect(() => {
    // localStorage is client-only, so the dashboard snapshot hydrates after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadProgress());

    return subscribeToProgress(() => setProgress(loadProgress()));
  }, []);

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
          Local profile
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
