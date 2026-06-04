"use client";

import { useState } from "react";

import { requestHintsAction } from "@/app/hint-actions";
import HintLevel from "@/components/HintLevel";
import type { AIHintOutput } from "@/lib/ai/types";
import type { Problem } from "@/lib/types";

type HintPanelProps = {
  problem: Problem;
  enabled?: boolean;
};

export default function HintPanel({ problem, enabled = true }: HintPanelProps) {
  const [hints, setHints] = useState<AIHintOutput | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadHints(nextRevealedCount: number) {
    setIsLoading(true);
    setMessage("");
    setErrorMessage("");

    const result = await requestHintsAction(problem.id);

    setIsLoading(false);

    if (result.status === "invalid") {
      setErrorMessage(result.message);
      return;
    }

    setHints(result.hints);
    setRevealedCount(nextRevealedCount);
    setMessage(result.status === "fallback" ? result.message : "");
  }

  function revealNextHint() {
    if (isLoading) {
      return;
    }

    if (!hints) {
      void loadHints(1);
      return;
    }

    setRevealedCount((current) =>
      Math.min(current + 1, hints.levels.length),
    );
  }

  const levels = hints?.levels ?? [];
  const hasLoadedHints = levels.length > 0;
  const canRevealMore = !hasLoadedHints || revealedCount < levels.length;
  const hintStatus = isLoading
    ? "Loading"
    : errorMessage
      ? "Hint failed"
      : revealedCount === 0
        ? "Not opened"
        : revealedCount === 5
          ? "Ladder complete"
          : "In progress";

  if (!enabled) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Hint Mode
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
          AI hints are unavailable
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Hint Mode is turned off for this beta environment. You can continue
          with recognition clues and the normal practice flow.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Hint Mode
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Coach nudge ladder
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Reveal one level at a time. The first level is a pattern clue, so
            open it only when you want that advantage before the quiz.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            {hintStatus}
          </span>
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {revealedCount}/5 revealed
          </span>
        </div>
      </div>

      {message ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">
          {message}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {!hasLoadedHints ? (
        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            Not opened
          </p>
          <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
            Start with Hint 1 when you want a pattern clue. The quiz answer
            stays hidden until you choose to reveal it.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid gap-3">
          {levels.map((hint, index) => (
            <HintLevel
              key={hint.level}
              hint={hint}
              isRevealed={index < revealedCount}
              canReveal={index === revealedCount}
              onReveal={revealNextHint}
            />
          ))}
        </div>
      )}

      {canRevealMore ? (
        <button
          type="button"
          onClick={revealNextHint}
          disabled={isLoading}
          className="mt-4 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading
            ? "Loading coach hints..."
            : revealedCount === 0
              ? "Reveal hint 1"
              : `Reveal hint ${revealedCount + 1}`}
        </button>
      ) : (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
          All hints revealed. Try solving from the ladder before checking any
          full solution.
        </p>
      )}
    </section>
  );
}
