"use client";

import { SignInButton } from "@clerk/nextjs";

import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import {
  getMasteryLevel,
  getPatternProgress,
} from "@/lib/mastery";
import { useAuthProgress } from "@/lib/use-auth-progress";
type PatternProgressProps = {
  patternId: string;
};

export function PatternMasteryBadge({ patternId }: PatternProgressProps) {
  const { isSignedIn, progress: userProgress } = useAuthProgress();
  const progress = getPatternProgress(patternId, userProgress);

  if (!isSignedIn) {
    return null;
  }

  return (
    <MasteryBadge
      level={getMasteryLevel(progress.masteryScore)}
      score={progress.masteryScore}
    />
  );
}

export function PatternMasteryBar({ patternId }: PatternProgressProps) {
  const { isSignedIn, progress: userProgress } = useAuthProgress();
  const progress = getPatternProgress(patternId, userProgress);

  if (!isSignedIn) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-900">
          Sign in to show your mastery score for this pattern.
        </p>
      </div>
    );
  }

  return (
    <ProgressBar
      value={progress.masteryScore}
      label="Mastery score"
      tone="indigo"
    />
  );
}

export function PatternProgressPanel({ patternId }: PatternProgressProps) {
  const { isSignedIn, progress: userProgress } = useAuthProgress();
  const progress = getPatternProgress(patternId, userProgress);
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
      {!isSignedIn ? (
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            User progress for this pattern
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Sign in to track progress
          </h2>
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              Saved mastery, attempts, solves, and recognition rates are shown
              only for signed-in users.
            </p>
            <SignInButton mode="modal">
              <button className="mt-3 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700">
                Sign in
              </button>
            </SignInButton>
          </div>
        </div>
      ) : (
        <>
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
            : "No saved attempts yet. Start a focused forge to create progress."}
        </p>
        </>
      )}
    </div>
  );
}
