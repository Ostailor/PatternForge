"use client";

import {
  createDebugInsightAction,
  createFlashcardFromDebugInsightAction,
  createMistakeFromDebugInsightAction,
} from "@/app/problems/[problemId]/workspace/actions";
import type { CodeRunStatus } from "@/lib/code-runner/types";
import { useState } from "react";

import type { DebugInsightView } from "./types";

type DebugCoachPanelProps = {
  codeRunId: string | null;
  runStatus: CodeRunStatus | null;
  initialInsight: DebugInsightView | null;
  enabled?: boolean;
  onInsightCreated?: (insight: DebugInsightView) => void;
};

function canAskDebugCoach(status: CodeRunStatus | null) {
  return Boolean(status && status !== "Succeeded" && status !== "Queued" && status !== "Running");
}

export default function DebugCoachPanel({
  codeRunId,
  runStatus,
  initialInsight,
  enabled = true,
  onInsightCreated,
}: DebugCoachPanelProps) {
  const [insight, setInsight] = useState<DebugInsightView | null>(
    initialInsight,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function askDebugCoach() {
    if (!codeRunId || isLoading) {
      return;
    }

    setIsLoading(true);
    setMessage("");
    const result = await createDebugInsightAction(codeRunId);
    setIsLoading(false);

    if (result.status === "created") {
      setInsight(result.insight);
      onInsightCreated?.(result.insight);
      return;
    }

    setMessage(result.message);
  }

  async function createFlashcard() {
    if (!insight) {
      return;
    }

    setMessage("");
    const result = await createFlashcardFromDebugInsightAction(insight.id);
    setMessage(result.message);
  }

  async function createMistake() {
    if (!insight) {
      return;
    }

    setMessage("");
    const result = await createMistakeFromDebugInsightAction(insight.id);
    setMessage(result.message);
  }

  if (!enabled) {
    return (
      <section
        id="debug-coach"
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Debug Coach
        </p>
        <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
          Debug Coach is unavailable
        </h2>
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          AI-powered run feedback is turned off for this beta environment. You
          can still inspect run output when code execution is enabled.
        </p>
      </section>
    );
  }

  return (
    <section
      id="debug-coach"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Debug Coach
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
        Runtime and test feedback
      </h2>
      {!canAskDebugCoach(runStatus) ? (
        <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          Debug Coach appears after a failed custom run, runtime error, timeout,
          or validation error.
        </p>
      ) : null}

      {canAskDebugCoach(runStatus) ? (
        <button
          type="button"
          onClick={askDebugCoach}
          disabled={isLoading || !codeRunId}
          className="mt-4 rounded-lg border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Reviewing..." : "Ask Debug Coach"}
        </button>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">
          {message}
        </p>
      ) : null}

      {insight ? (
        <div className="mt-4 space-y-3">
          <InsightBlock label="Summary" value={insight.summary} />
          <InsightBlock label="Likely cause" value={insight.likelyCause} />
          <InsightBlock label="Suggested fix" value={insight.suggestedFix} />
          {insight.followUpQuestion ? (
            <InsightBlock
              label="Follow-up question"
              value={insight.followUpQuestion}
            />
          ) : null}
          {insight.suggestedTestCase ? (
            <InsightBlock
              label="Suggested custom test"
              value={`${insight.suggestedTestCase.name}\nInput: ${JSON.stringify(
                insight.suggestedTestCase.inputJson,
              )}\nExpected: ${JSON.stringify(
                insight.suggestedTestCase.expectedOutputJson,
              )}`}
            />
          ) : null}
          {insight.suggestedFlashcard ? (
            <InsightBlock
              label="Suggested flashcard"
              value={`${insight.suggestedFlashcard.front}\n\n${insight.suggestedFlashcard.back}`}
            />
          ) : null}
          {insight.suggestedMistake ? (
            <InsightBlock
              label="Suggested mistake"
              value={`${insight.suggestedMistake.mistakeType}\n${insight.suggestedMistake.description}\nFix: ${insight.suggestedMistake.correction}`}
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={createFlashcard}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Create flashcard
            </button>
            <button
              type="button"
              onClick={createMistake}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Create mistake card
            </button>
          </div>
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold leading-5 text-slate-500">
            Follow-up chat is not wired into this workspace yet. Use the
            follow-up question to guide the next run or custom test.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function InsightBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}
