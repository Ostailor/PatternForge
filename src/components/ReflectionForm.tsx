"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import { useState } from "react";

import { saveAttemptAction, type SaveAttemptInput } from "@/app/practice-actions";
import type { Attempt, Confidence, Problem, SolvedStatus } from "@/lib/types";
import { notifyAccountProgressChanged } from "@/lib/use-auth-progress";

type ReflectionFormProps = {
  problem: Problem;
  selectedPatternId: string;
  codeSubmissionId?: string;
  onSaved?: (attempt: Attempt) => void;
};

export default function ReflectionForm({
  problem,
  selectedPatternId,
  codeSubmissionId,
  onSaved,
}: ReflectionFormProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const [solvedStatus, setSolvedStatus] = useState<SolvedStatus>("Not Solved");
  const [timeSpentMinutes, setTimeSpentMinutes] = useState(
    problem.estimatedMinutes,
  );
  const [confidence, setConfidence] = useState<Confidence>(3);
  const [recognizedClue, setRecognizedClue] = useState("");
  const [mistake, setMistake] = useState("");
  const [nextMemory, setNextMemory] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function saveReflection() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    const reflection = [
      `Clue: ${recognizedClue.trim() || "Not recorded"}`,
      `Mistake: ${mistake.trim() || "Not recorded"}`,
      `Next time: ${nextMemory.trim() || "Not recorded"}`,
    ].join("\n");
    const attempt: SaveAttemptInput = {
      problemId: problem.id,
      selectedPatternId,
      solvedStatus,
      timeSpentMinutes,
      confidence,
      reflection,
      codeSubmissionId,
    };

    const result = await saveAttemptAction(attempt);

    setIsSaving(false);

    if (result.status === "saved") {
      notifyAccountProgressChanged();
      onSaved?.(result.attempt);
      return;
    }

    setErrorMessage(
      result.status === "unauthenticated"
        ? "Sign in to save this attempt."
        : result.message,
    );
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

        {errorMessage ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        {isLoaded && !isSignedIn ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-900">
              Sign in to save attempts and build persistent mastery.
            </p>
            <SignInButton mode="modal">
              <button className="mt-3 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
                Sign in to save attempt
              </button>
            </SignInButton>
          </div>
        ) : null}

        {isSignedIn ? (
          <button
            type="button"
            onClick={saveReflection}
            disabled={isSaving}
            className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save attempt"}
          </button>
        ) : null}
      </div>
    </section>
  );
}
