"use client";

import { useMemo, useState } from "react";
import type {
  CommunicationInsightType,
  InsightSeverity,
  InterviewPhase,
  InterviewMessageRole,
  VoiceSpeaker,
} from "@/generated/prisma/enums";

type TranscriptTurn = {
  id: string;
  source: "message" | "voice";
  role: InterviewMessageRole | VoiceSpeaker;
  phase: InterviewPhase;
  content: string;
  createdAt: string;
  roundNumber: number | null;
  problemTitle: string | null;
  durationMs: number | null;
};

type TranscriptInsight = {
  id: string;
  insightType: CommunicationInsightType;
  severity: InsightSeverity;
  summary: string;
  evidence: Record<string, unknown>;
};

type VoiceTranscriptClientProps = {
  turns: TranscriptTurn[];
  insights: TranscriptInsight[];
};

const phases: Array<InterviewPhase | "all"> = [
  "all",
  "Setup",
  "ClarifyingQuestions",
  "PatternHypothesis",
  "Approach",
  "Implementation",
  "Testing",
  "Complexity",
  "Feedback",
];

function formatPhase(phase: InterviewPhase | "all"): string {
  if (phase === "all") {
    return "All phases";
  }

  switch (phase) {
    case "ClarifyingQuestions":
      return "Clarifying Questions";
    case "PatternHypothesis":
      return "Pattern Hypothesis";
    default:
      return phase.replace(/([A-Z])/g, " $1").trim();
  }
}

function formatTimestamp(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(durationMs: number | null): string | null {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;
}

function getEvidenceText(insight: TranscriptInsight): string {
  const quote = insight.evidence.quote;
  const reason = insight.evidence.reason;

  if (typeof quote === "string" && quote.trim()) {
    return quote.trim();
  }

  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }

  return insight.summary;
}

function getRelatedInsights(
  turn: TranscriptTurn,
  insights: TranscriptInsight[],
): TranscriptInsight[] {
  const content = turn.content.toLowerCase();

  return insights.filter((insight) => {
    const evidencePhase = insight.evidence.phase;
    const evidenceQuote = insight.evidence.quote;

    if (typeof evidencePhase === "string" && evidencePhase === turn.phase) {
      return true;
    }

    if (
      typeof evidenceQuote === "string" &&
      evidenceQuote.trim() &&
      content.includes(evidenceQuote.trim().toLowerCase())
    ) {
      return true;
    }

    return false;
  });
}

function buildCopyText(turns: TranscriptTurn[]): string {
  return turns
    .map((turn) => {
      const round = turn.roundNumber ? `Round ${turn.roundNumber}` : "Interview";
      const problem = turn.problemTitle ? ` · ${turn.problemTitle}` : "";

      return [
        `[${formatTimestamp(turn.createdAt)}] ${round}${problem}`,
        `${turn.role} · ${formatPhase(turn.phase)} · ${turn.source === "voice" ? "Voice transcript" : "Interview message"}`,
        turn.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

export default function VoiceTranscriptClient({
  turns,
  insights,
}: VoiceTranscriptClientProps) {
  const [phaseFilter, setPhaseFilter] = useState<InterviewPhase | "all">("all");
  const [expandedTurnIds, setExpandedTurnIds] = useState<Set<string>>(
    () => new Set(turns.map((turn) => turn.id)),
  );
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const filteredTurns = useMemo(
    () =>
      phaseFilter === "all"
        ? turns
        : turns.filter((turn) => turn.phase === phaseFilter),
    [phaseFilter, turns],
  );

  async function copyTranscript() {
    try {
      await navigator.clipboard.writeText(buildCopyText(filteredTurns));
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("failed");
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    }
  }

  function toggleTurn(turnId: string) {
    setExpandedTurnIds((current) => {
      const next = new Set(current);

      if (next.has(turnId)) {
        next.delete(turnId);
      } else {
        next.add(turnId);
      }

      return next;
    });
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Filter by phase
            </span>
            <select
              value={phaseFilter}
              onChange={(event) =>
                setPhaseFilter(event.target.value as InterviewPhase | "all")
              }
              className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {formatPhase(phase)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                setExpandedTurnIds(new Set(filteredTurns.map((turn) => turn.id)))
              }
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Expand turns
            </button>
            <button
              type="button"
              onClick={() => setExpandedTurnIds(new Set())}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Collapse turns
            </button>
            <button
              type="button"
              onClick={copyTranscript}
              className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-700"
            >
              {copyStatus === "copied"
                ? "Copied"
                : copyStatus === "failed"
                  ? "Copy failed"
                  : "Copy transcript"}
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredTurns.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold leading-6 text-slate-600">
            No transcript turns match this phase.
          </p>
        ) : (
          filteredTurns.map((turn) => {
            const relatedInsights = getRelatedInsights(turn, insights);
            const isExpanded = expandedTurnIds.has(turn.id);
            const duration = formatDuration(turn.durationMs);

            return (
              <article
                key={turn.id}
                className={`rounded-lg border p-4 shadow-sm ${
                  relatedInsights.length > 0
                    ? "border-amber-200 bg-amber-50"
                    : turn.source === "voice"
                      ? "border-teal-200 bg-teal-50"
                      : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      {turn.role} · {formatPhase(turn.phase)}
                    </p>
                    <p className="mt-1 text-sm font-bold text-slate-700">
                      {turn.roundNumber ? `Round ${turn.roundNumber}` : "Interview"}
                      {turn.problemTitle ? ` · ${turn.problemTitle}` : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                        {formatTimestamp(turn.createdAt)}
                      </span>
                      <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                        {turn.source === "voice"
                          ? "Voice transcript"
                          : "Interview message"}
                      </span>
                      {duration ? (
                        <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                          {duration}
                        </span>
                      ) : null}
                      {relatedInsights.length > 0 ? (
                        <span className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs font-black text-amber-700">
                          Feedback-linked
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleTurn(turn.id)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    {isExpanded ? "Collapse" : "Expand"}
                  </button>
                </div>

                {isExpanded ? (
                  <>
                    <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                      {turn.content}
                    </p>
                    {relatedInsights.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {relatedInsights.map((insight) => (
                          <div
                            key={insight.id}
                            className="rounded-lg border border-amber-200 bg-white p-3"
                          >
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
                              {insight.insightType} · {insight.severity}
                            </p>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                              {insight.summary}
                            </p>
                            <p className="mt-2 text-xs font-bold leading-5 text-slate-500">
                              Evidence: {getEvidenceText(insight)}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
