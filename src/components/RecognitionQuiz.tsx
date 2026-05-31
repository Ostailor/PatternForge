"use client";

import { useMemo, useState } from "react";

import type { Pattern, Problem } from "@/lib/types";

type RecognitionQuizProps = {
  problem: Problem;
  patterns: Pattern[];
  onContinue?: (selectedPatternId: string, wasCorrect: boolean) => void;
};

function seededSortKey(seed: string, value: string): number {
  return Array.from(`${seed}:${value}`).reduce(
    (total, char) => total + char.charCodeAt(0),
    0,
  );
}

function buildOptions(problem: Problem, patterns: Pattern[]): Pattern[] {
  const correctPattern = patterns.find(
    (pattern) => pattern.id === problem.primaryPatternId,
  );
  const wrongPatterns = patterns
    .filter((pattern) => pattern.id !== problem.primaryPatternId)
    .sort(
      (a, b) =>
        Math.abs(a.levelOrder - (correctPattern?.levelOrder ?? 1)) -
          Math.abs(b.levelOrder - (correctPattern?.levelOrder ?? 1)) ||
        seededSortKey(problem.id, a.id) - seededSortKey(problem.id, b.id),
    )
    .slice(0, 3);

  return [correctPattern, ...wrongPatterns]
    .filter((pattern) => pattern !== undefined)
    .sort(
      (a, b) =>
        seededSortKey(problem.id, a.id) - seededSortKey(problem.id, b.id),
    );
}

export default function RecognitionQuiz({
  problem,
  patterns,
  onContinue,
}: RecognitionQuizProps) {
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const options = useMemo(
    () => buildOptions(problem, patterns),
    [problem, patterns],
  );
  const correctPattern = patterns.find(
    (pattern) => pattern.id === problem.primaryPatternId,
  );
  const selectedPattern = patterns.find(
    (pattern) => pattern.id === selectedPatternId,
  );
  const hasAnswered = selectedPatternId.length > 0;
  const wasCorrect = selectedPatternId === problem.primaryPatternId;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Step 2
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            What pattern do you think this problem uses?
          </h2>
        </div>
        {hasAnswered ? (
          <span
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${
              wasCorrect
                ? "bg-teal-50 text-teal-700"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {wasCorrect ? "Correct" : "Review"}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {options.map((pattern) => (
          <button
            key={pattern.id}
            type="button"
            disabled={hasAnswered}
            onClick={() => setSelectedPatternId(pattern.id)}
            className={`rounded-lg border p-4 text-left transition ${
              selectedPatternId === pattern.id
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
            } ${hasAnswered && selectedPatternId !== pattern.id ? "opacity-70" : ""}`}
          >
            <span className="block text-sm font-black">{pattern.name}</span>
            <span className="mt-1 block text-xs font-medium opacity-80">
              {pattern.category}
            </span>
          </button>
        ))}
      </div>

      {hasAnswered ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            {wasCorrect ? "You matched it." : "Not quite."}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            You chose <strong>{selectedPattern?.name}</strong>. The seeded
            pattern is <strong>{correctPattern?.name}</strong>.
          </p>
          <div className="mt-4 grid gap-2">
            {problem.recognitionClues.map((clue) => (
              <p
                key={clue}
                className="rounded-md bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-600"
              >
                {clue}
              </p>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onContinue?.(selectedPatternId, wasCorrect)}
            className="mt-5 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Continue to Reflection
          </button>
        </div>
      ) : null}
    </section>
  );
}
