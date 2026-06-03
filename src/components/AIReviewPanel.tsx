"use client";

import { useState } from "react";

import { requestAIReviewAction } from "@/app/ai-review-actions";
import AIReviewResult from "@/components/AIReviewResult";
import type { SavedAIReview } from "@/lib/ai/types";
import type { Attempt } from "@/lib/types";

type AIReviewPanelProps = {
  attempt: Attempt;
  hasLinkedWorkspaceCode?: boolean;
};

export default function AIReviewPanel({
  attempt,
  hasLinkedWorkspaceCode = false,
}: AIReviewPanelProps) {
  const [userCode, setUserCode] = useState("");
  const [userExplanation, setUserExplanation] = useState("");
  const [review, setReview] = useState<SavedAIReview | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const hasCode = userCode.trim().length > 0;
  const hasExplanation = userExplanation.trim().length > 0;
  const panelStatus = review
    ? "Review complete"
    : isReviewing
      ? "Reviewing..."
      : errorMessage
        ? errorMessage.startsWith("Not signed in")
          ? "Not signed in"
          : "Review failed"
        : "Not reviewed yet";

  async function requestReview() {
    if (isReviewing) {
      return;
    }

    setIsReviewing(true);
    setErrorMessage("");

    const result = await requestAIReviewAction({
      attemptId: attempt.id,
      userCode,
      userExplanation,
    });

    setIsReviewing(false);

    if (result.status === "saved") {
      setReview(result.review);
      return;
    }

    setErrorMessage(
      result.status === "unauthenticated"
        ? "Not signed in. Sign in again to save a Coach Review."
        : result.message,
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Coach Review
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Forge feedback from your attempt
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Paste your solution, your explanation, or both. If you used the Code
            Workspace, the coach can also use your latest linked code run.
          </p>
        </div>
        <StatusPill status={panelStatus} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CoachState label="Attempt saved" tone="teal" />
        <CoachState
          label={
            hasCode
              ? "Code provided"
              : hasLinkedWorkspaceCode
                ? "Workspace code linked"
                : "No code provided"
          }
          tone={hasCode || hasLinkedWorkspaceCode ? "teal" : "slate"}
        />
        <CoachState
          label={
            hasExplanation ? "Explanation provided" : "No explanation provided"
          }
          tone={hasExplanation ? "teal" : "slate"}
        />
      </div>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Code
          <textarea
            value={userCode}
            onChange={(event) => setUserCode(event.target.value)}
            rows={8}
            spellCheck={false}
            className="font-mono min-h-48 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white"
            placeholder="Paste your solution code."
          />
        </label>

        <label className="grid gap-2 text-sm font-bold text-slate-700">
          Explanation
          <textarea
            value={userExplanation}
            onChange={(event) => setUserExplanation(event.target.value)}
            rows={4}
            className="min-h-28 resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium leading-6 text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white"
            placeholder="Explain your approach, tradeoffs, or where you got stuck."
          />
        </label>

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-black text-rose-800">Review failed</p>
            <p className="mt-1 text-sm font-bold leading-6 text-rose-700">
              {errorMessage}
            </p>
          </div>
        ) : null}

        {!review && !isReviewing ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">
              Not reviewed yet
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              Add code or explanation if you want to supplement the saved
              attempt and any linked workspace run.
            </p>
          </div>
        ) : null}

        {isReviewing ? (
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
            <p className="text-sm font-black text-teal-800">Reviewing...</p>
            <p className="mt-1 text-sm font-bold leading-6 text-teal-700">
              AI Coach is checking pattern recognition, implementation shape,
              complexity, and next training move.
            </p>
          </div>
        ) : null}

        <button
          type="button"
          onClick={requestReview}
          disabled={isReviewing}
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isReviewing ? "Reviewing..." : "Review with AI Coach"}
        </button>

        {review ? <AIReviewResult review={review} /> : null}
      </div>
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "Review complete"
      ? "border-teal-200 bg-teal-50 text-teal-700"
      : status === "Review failed" || status === "Not signed in"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : status === "Reviewing..."
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${tone}`}
    >
      {status}
    </span>
  );
}

function CoachState({
  label,
  tone,
}: {
  label: string;
  tone: "teal" | "slate";
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 ${
        tone === "teal"
          ? "border-teal-200 bg-teal-50 text-teal-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em]">{label}</p>
    </div>
  );
}
