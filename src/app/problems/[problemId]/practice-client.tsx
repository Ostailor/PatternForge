"use client";

import { useState } from "react";

import AIReviewPanel from "@/components/AIReviewPanel";
import HintPanel from "@/components/HintPanel";
import RecognitionQuiz from "@/components/RecognitionQuiz";
import ReflectionForm from "@/components/ReflectionForm";
import SessionSummary from "@/components/SessionSummary";
import { getPatternById } from "@/data/patterns";
import type { Attempt, Pattern, Problem } from "@/lib/types";

type PracticeStep = "preview" | "quiz" | "reflection" | "summary";

type ProblemPracticeClientProps = {
  problem: Problem;
  patterns: Pattern[];
};

const difficultyStyles: Record<Problem["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function ProblemPracticeClient({
  problem,
  patterns,
}: ProblemPracticeClientProps) {
  const [step, setStep] = useState<PracticeStep>("preview");
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [savedAttempt, setSavedAttempt] = useState<Attempt | undefined>();
  const correctPattern = getPatternById(problem.primaryPatternId);

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Practice flow
          </p>
          <div className="mt-5 space-y-3">
            {[
              ["preview", "Problem Preview"],
              ["quiz", "Pattern Recognition"],
              ["reflection", "Reflection"],
              ["summary", "Summary"],
            ].map(([stepId, label], index) => (
              <div
                key={stepId}
                className={`rounded-lg border p-3 ${
                  step === stepId
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-[0.14em]">
                  0{index + 1}
                </p>
                <p className="mt-1 text-sm font-black">{label}</p>
              </div>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          {step === "preview" ? (
            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                    Step 1
                  </p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                    {problem.title}
                  </h1>
                  <p className="mt-2 text-sm font-semibold text-slate-500">
                    Estimated time: {problem.estimatedMinutes} min
                  </p>
                </div>
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-bold ${difficultyStyles[problem.difficulty]}`}
                >
                  {problem.difficulty}
                </span>
              </div>

              <div className="mt-6">
                <h2 className="text-lg font-black tracking-tight text-slate-950">
                  Recognition clues
                </h2>
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
                  onClick={() => setStep("quiz")}
                  className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
                >
                  I opened it, start recognition quiz
                </button>
              </div>
            </section>
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

          {step === "preview" || step === "quiz" ? (
            <HintPanel problem={problem} />
          ) : null}

          {step === "reflection" ? (
            <ReflectionForm
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
              <AIReviewPanel attempt={savedAttempt} />
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
