"use client";

import { useEffect, useState } from "react";

import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import {
  getMasteryLevel,
  getPatternProgress,
} from "@/lib/mastery";
import {
  createEmptyProgress,
  loadProgress,
  subscribeToProgress,
} from "@/lib/progress";
import type { PatternProgress, UserProgress } from "@/lib/types";

type PatternProgressProps = {
  patternId: string;
};

function usePatternProgress(patternId: string): PatternProgress {
  const [progress, setProgress] = useState<UserProgress>(createEmptyProgress);

  useEffect(() => {
    // localStorage is the temporary progress source for v0.0.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadProgress());

    return subscribeToProgress(() => setProgress(loadProgress()));
  }, []);

  return getPatternProgress(patternId, progress);
}

export function PatternMasteryBadge({ patternId }: PatternProgressProps) {
  const progress = usePatternProgress(patternId);

  return (
    <MasteryBadge
      level={getMasteryLevel(progress.masteryScore)}
      score={progress.masteryScore}
    />
  );
}

export function PatternMasteryBar({ patternId }: PatternProgressProps) {
  const progress = usePatternProgress(patternId);

  return (
    <ProgressBar
      value={progress.masteryScore}
      label="Mastery score"
      tone="indigo"
    />
  );
}

export function PatternProgressPanel({ patternId }: PatternProgressProps) {
  const progress = usePatternProgress(patternId);
  const recognitionRate =
    progress.recognitionAttempts === 0
      ? 0
      : Math.round(
          (progress.recognitionCorrect / progress.recognitionAttempts) * 100,
        );

  const stats = [
    { label: "Attempts", value: progress.attemptedCount },
    { label: "Solved", value: progress.solvedCount },
    { label: "Recognition", value: `${recognitionRate}%` },
  ];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            User progress for this pattern
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Level {getMasteryLevel(progress.masteryScore)}
          </h2>
        </div>
        <p className="text-3xl font-black text-slate-950">
          {progress.masteryScore}%
        </p>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {stat.label}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-sm font-semibold text-slate-500">
        {progress.lastPracticedAt
          ? `Last practiced ${new Date(progress.lastPracticedAt).toLocaleDateString()}`
          : "No local attempts yet. Start a focused forge to create progress."}
      </p>
    </div>
  );
}
