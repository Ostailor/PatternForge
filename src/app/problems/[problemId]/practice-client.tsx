"use client";

import Link from "next/link";
import { useState } from "react";

import AIReviewPanel from "@/components/AIReviewPanel";
import { CodeWorkspace } from "@/components/code-workspace";
import type {
  DebugInsightView,
  WorkspaceRunSummary,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "@/components/code-workspace/types";
import HintPanel from "@/components/HintPanel";
import RecognitionQuiz from "@/components/RecognitionQuiz";
import ReflectionForm from "@/components/ReflectionForm";
import SessionSummary from "@/components/SessionSummary";
import { getPatternById } from "@/data/patterns";
import {
  getMasteryLevel,
  getMasteryLevelNumber,
  getPatternProgress,
} from "@/lib/mastery";
import { mergeAttempt } from "@/lib/progress";
import type { Attempt, Pattern, Problem } from "@/lib/types";
import { useAuthProgress } from "@/lib/use-auth-progress";

type PracticeStep = "preview" | "quiz" | "workspace" | "reflection" | "summary";

type ProblemPracticeClientProps = {
  problem: Problem;
  patterns: Pattern[];
  runnerConfigured: boolean;
  codeRunnerEnabled: boolean;
  codeRunnerUnavailableMessage?: string;
  aiCoachEnabled: boolean;
  initialHistory: WorkspaceSubmissionHistoryItem[];
  initialTestCases: WorkspaceTestCaseItem[];
  initialDebugInsight: DebugInsightView | null;
  isAuthenticated: boolean;
};

const difficultyStyles: Record<Problem["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function ProblemPracticeClient({
  problem,
  patterns,
  runnerConfigured,
  codeRunnerEnabled,
  codeRunnerUnavailableMessage,
  aiCoachEnabled,
  initialHistory,
  initialTestCases,
  initialDebugInsight,
  isAuthenticated,
}: ProblemPracticeClientProps) {
  const { progress } = useAuthProgress();
  const [step, setStep] = useState<PracticeStep>("preview");
  const [selectedPatternId, setSelectedPatternId] = useState("");
  const [savedAttempt, setSavedAttempt] = useState<Attempt | undefined>();
  const [codeSubmissionId, setCodeSubmissionId] = useState<
    string | undefined
  >();
  const [latestRunSummary, setLatestRunSummary] =
    useState<WorkspaceRunSummary | null>(null);
  const [latestDebugInsight, setLatestDebugInsight] =
    useState<DebugInsightView | null>(null);
  const [levelUp, setLevelUp] = useState<{
    patternName: string;
    levelName: string;
    levelNumber: number;
  } | null>(null);
  const correctPattern = getPatternById(problem.primaryPatternId);

  function detectLevelUp(attempt: Attempt) {
    const pattern = getPatternById(attempt.correctPatternId);

    if (!pattern) {
      return null;
    }

    const beforeProgress = getPatternProgress(attempt.correctPatternId, progress);
    const afterProgress = getPatternProgress(
      attempt.correctPatternId,
      mergeAttempt(progress, attempt),
    );
    const beforeLevelNumber = getMasteryLevelNumber(beforeProgress.masteryScore);
    const afterLevelNumber = getMasteryLevelNumber(afterProgress.masteryScore);

    if (afterLevelNumber <= beforeLevelNumber) {
      return null;
    }

    return {
      patternName: pattern.name,
      levelName: getMasteryLevel(afterProgress.masteryScore),
      levelNumber: afterLevelNumber,
    };
  }

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
              ["workspace", "Code Workspace"],
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
                <Link
                  href={`/problems/${problem.id}/workspace?mode=Practice`}
                  className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Open Code Workspace
                </Link>
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
                setStep("workspace");
              }}
            />
          ) : null}

          {step === "preview" || step === "quiz" ? (
            <HintPanel problem={problem} enabled={aiCoachEnabled} />
          ) : null}

          {step === "workspace" ? (
            <div className="space-y-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                      Step 3
                    </p>
                    <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                      Code workspace
                    </h2>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                      Write Python and run your own custom tests. This step is
                      optional; you can continue to reflection without running
                      code.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("reflection")}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
                  >
                    Continue to reflection
                  </button>
                </div>
              </section>
              <CodeWorkspace
                problem={problem}
                context={{
                  mode: "Practice",
                  returnHref: `/problems/${problem.id}`,
                  returnLabel: "Back to Practice",
                }}
                runnerConfigured={runnerConfigured}
                codeRunnerEnabled={codeRunnerEnabled}
                codeRunnerUnavailableMessage={codeRunnerUnavailableMessage}
                aiCoachEnabled={aiCoachEnabled}
                initialHistory={initialHistory}
                initialTestCases={initialTestCases}
                initialDebugInsight={initialDebugInsight}
                isAuthenticated={isAuthenticated}
                embedded
                onSubmissionChange={setCodeSubmissionId}
                onRunChange={setLatestRunSummary}
                onDebugInsightChange={setLatestDebugInsight}
                onSaveAttempt={() => setStep("reflection")}
              />
            </div>
          ) : null}

          {step === "reflection" ? (
            <ReflectionForm
              problem={problem}
              selectedPatternId={selectedPatternId}
              codeSubmissionId={codeSubmissionId}
              onSaved={(attempt) => {
                setLevelUp(detectLevelUp(attempt));
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
                levelUp={levelUp}
                codeRunSummary={latestRunSummary}
                latestDebugInsight={latestDebugInsight}
              />
              <div id="ai-coach">
                <AIReviewPanel
                  attempt={savedAttempt}
                  hasLinkedWorkspaceCode={Boolean(codeSubmissionId)}
                  enabled={aiCoachEnabled}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
