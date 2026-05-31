"use client";

import { useState } from "react";

import { saveAttempt } from "@/lib/progress";
import type { Attempt, Confidence, Problem, SolvedStatus } from "@/lib/types";

type ReflectionFormProps = {
  problem: Problem;
  selectedPatternId: string;
  wasPatternCorrect: boolean;
  onSaved?: (attempt: Attempt) => void;
};

export default function ReflectionForm({
  problem,
  selectedPatternId,
  wasPatternCorrect,
  onSaved,
}: ReflectionFormProps) {
  const [solvedStatus, setSolvedStatus] = useState<SolvedStatus>("Not Solved");
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(
    problem.estimatedMinutes,
  );
  const [confidence, setConfidence] = useState<Confidence>(3);
  const [recognizedClue, setRecognizedClue] = useState("");
  const [mistake, setMistake] = useState("");
  const [nextMemory, setNextMemory] = useState("");

  function saveReflection() {
    const reflection = [
      `Clue: ${recognizedClue.trim() || "Not recorded"}`,
      `Mistake: ${mistake.trim() || "Not recorded"}`,
      `Next time: ${nextMemory.trim() || "Not recorded"}`,
    ].join("\n");
    const attempt: Attempt = {
      problemId: problem.id,
      selectedPatternId,
      correctPatternId: problem.primaryPatternId,
      wasPatternCorrect,
      solvedStatus,
      timeSpentMinutes,
      confidence,
      reflection,
      createdAt: new Date().toISOString(),
    };

    saveAttempt(attempt);
    onSaved?.(attempt);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Step 3
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
          Reflection
        </h2>
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Solved status
          <select
            value={solvedStatus}
            onChange={(event) =>
              setSolvedStatus(event.target.value as SolvedStatus)
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-teal-500"
          >
            <option value="Solved">Solved</option>
            <option value="Partially Solved">Partially Solved</option>
            <option value="Not Solved">Not Solved</option>
          </select>
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Time spent in minutes
          <input
            type="number"
            min="1"
            max="240"
            value={timeSpentMinutes}
            onChange={(event) =>
              setTimeSpentMinutes(Number(event.target.value))
            }
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-teal-500"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Confidence: {confidence}/5
          <input
            type="range"
            min="1"
            max="5"
            value={confidence}
            onChange={(event) =>
              setConfidence(Number(event.target.value) as Confidence)
            }
            className="accent-teal-600"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          What clue helped you recognize the pattern?
          <textarea
            value={recognizedClue}
            onChange={(event) => setRecognizedClue(event.target.value)}
            rows={3}
            className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-6 text-slate-950 outline-none focus:border-teal-500"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          What mistake did you make?
          <textarea
            value={mistake}
            onChange={(event) => setMistake(event.target.value)}
            rows={3}
            className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-6 text-slate-950 outline-none focus:border-teal-500"
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          What would you remember next time?
          <textarea
            value={nextMemory}
            onChange={(event) => setNextMemory(event.target.value)}
            rows={3}
            className="resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-6 text-slate-950 outline-none focus:border-teal-500"
          />
        </label>

        <button
          type="button"
          onClick={saveReflection}
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Save attempt
        </button>
      </div>
    </section>
  );
}
