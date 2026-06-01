"use client";

import Link from "next/link";
import { useState } from "react";

import {
  saveBattleRoundAttemptAction,
  type SaveBattleRoundAttemptInput,
} from "@/app/battles/[battleId]/actions";
import AIReviewPanel from "@/components/AIReviewPanel";
import RecognitionQuiz from "@/components/RecognitionQuiz";
import SessionSummary from "@/components/SessionSummary";
import { getPatternById } from "@/data/patterns";
import type { Attempt, Confidence, Pattern, Problem, SolvedStatus } from "@/lib/types";

type BattleRoundStep = "preview" | "quiz" | "reflection" | "summary";

type BattleRoundClientProps = {
  battleId: string;
  roundId: string;
  problem: Problem;
  patterns: Pattern[];
  isFinalRound: boolean;
};

const difficultyStyles: Record<Problem["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function BattleRoundClient({
  battleId,
  roundId,
  problem,
  patterns,
  isFinalRound,
}: BattleRoundClientProps) {
  const [step, setStep] = useState<BattleRoundStep>("preview");
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [savedAttempt, setSavedAttempt] = useState<Attempt | null>(null);
  const correctPattern = getPatternById(problem.primaryPatternId);

  return (
    <div className="space-y-5">
      <BattleStepRail currentStep={step} />

      {step === "preview" ? (
        <ProblemPreview problem={problem} onStart={() => setStep("quiz")} />
      ) : null}

      {step === "quiz" ? (
        <RecognitionQuiz
          problem={problem}
          patterns={patterns}
          onContinue={(nextSelectedPatternId) => {
            setSelectedPatternId(nextSelectedPatternId);
            setStep("reflection");
          }}
        />
      ) : null}

      {step === "reflection" ? (
        <BattleReflectionForm
          battleId={battleId}
          roundId={roundId}
          problem={problem}
          selectedPatternId={selectedPatternId}
          onSaved={(attempt) => {
            setSavedAttempt(attempt);
            setStep("summary");
          }}
        />
      ) : null}

      {step === "summary" && savedAttempt ? (
        <>
          <SessionSummary
            attempt={savedAttempt}
            problem={problem}
            correctPattern={correctPattern}
          />
          <div id="ai-coach">
            <AIReviewPanel attempt={savedAttempt} />
          </div>
          {!isFinalRound ? (
            <Link
              href={`/battles/${battleId}`}
              className="block rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
            >
              Next Round
            </Link>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function BattleStepRail({ currentStep }: { currentStep: BattleRoundStep }) {
  const steps: [BattleRoundStep, string][] = [
    ["preview", "Problem Intel"],
    ["quiz", "Pattern Read"],
    ["reflection", "Attempt Log"],
    ["summary", "Round Result"],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-4">
      {steps.map(([step, label], index) => (
        <div
          key={step}
          className={`rounded-lg border p-3 ${
            currentStep === step
              ? "border-slate-950 bg-slate-950 text-white"
              : "border-slate-200 bg-white text-slate-600"
          }`}
        >
          <p className="text-xs font-black uppercase tracking-[0.14em]">
            0{index + 1}
          </p>
          <p className="mt-1 text-sm font-black">{label}</p>
        </div>
      ))}
    </div>
  );
}

function ProblemPreview({
  problem,
  onStart,
}: {
  problem: Problem;
  onStart: () => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Problem
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {problem.title}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Estimated time: {problem.estimatedMinutes} min
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${difficultyStyles[problem.difficulty]}`}
        >
          {problem.difficulty}
        </span>
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-black tracking-tight text-slate-950">
          Recognition clues
        </h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {problem.recognitionClues.map((clue) => (
            <div
              key={clue}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600"
            >
              {clue}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <a
          href={problem.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open Problem on LeetCode
        </a>
        <button
          type="button"
          onClick={onStart}
          className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Start Pattern Recognition
        </button>
      </div>
    </section>
  );
}

function BattleReflectionForm({
  battleId,
  roundId,
  problem,
  selectedPatternId,
  onSaved,
}: {
  battleId: string;
  roundId: string;
  problem: Problem;
  selectedPatternId: string;
  onSaved: (attempt: Attempt) => void;
}) {
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

  async function saveRound() {
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
    const input: SaveBattleRoundAttemptInput = {
      battleId,
      roundId,
      problemId: problem.id,
      selectedPatternId,
      solvedStatus,
      timeSpentMinutes,
      confidence,
      reflection,
    };
    const result = await saveBattleRoundAttemptAction(input);

    setIsSaving(false);

    if (result.status === "saved") {
      onSaved(result.attempt);
      return;
    }

    setErrorMessage(
      result.status === "unauthenticated"
        ? "Sign in again to save this battle round."
        : result.message,
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Round attempt
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Save this round
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          Pattern locked
        </span>
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

        <button
          type="button"
          onClick={saveRound}
          disabled={isSaving}
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving round..." : "Save Round"}
        </button>
      </div>
    </section>
  );
}
