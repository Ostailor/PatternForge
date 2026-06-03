"use client";

import type { InterviewPhase, VoiceSpeaker } from "@/generated/prisma/enums";

import type { VoiceTurnStatus } from "./types";

type VoiceTurnCardProps = {
  phase: InterviewPhase;
  speaker: VoiceSpeaker;
  transcript: string;
  status?: VoiceTurnStatus;
  durationMs?: number | null;
  createdAt?: string | Date | null;
  audioUrl?: string | null;
};

function formatPhase(phase: InterviewPhase): string {
  switch (phase) {
    case "ClarifyingQuestions":
      return "Clarifying Questions";
    case "PatternHypothesis":
      return "Pattern Hypothesis";
    default:
      return phase.replace(/([A-Z])/g, " $1").trim();
  }
}

function formatDuration(durationMs: number | null | undefined): string | null {
  if (!durationMs || durationMs <= 0) {
    return null;
  }

  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0
    ? `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`
    : `${remainingSeconds}s`;
}

function formatCreatedAt(createdAt: string | Date | null | undefined): string | null {
  if (!createdAt) {
    return null;
  }

  const date = typeof createdAt === "string" ? new Date(createdAt) : createdAt;

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSpeakerTone(speaker: VoiceSpeaker): string {
  switch (speaker) {
    case "User":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "Interviewer":
      return "border-teal-200 bg-teal-50 text-teal-800";
    case "System":
      return "border-amber-200 bg-amber-50 text-amber-800";
  }
}

function getStatusTone(status: VoiceTurnStatus): string {
  switch (status) {
    case "saved":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "processing":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "failed":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "draft":
      return "border-slate-200 bg-white text-slate-600";
  }
}

export default function VoiceTurnCard({
  phase,
  speaker,
  transcript,
  status = "saved",
  durationMs,
  createdAt,
  audioUrl,
}: VoiceTurnCardProps) {
  const duration = formatDuration(durationMs);
  const created = formatCreatedAt(createdAt);

  return (
    <article className={`rounded-lg border p-4 ${getSpeakerTone(speaker)}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] opacity-75">
            {speaker} · {formatPhase(phase)}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${getStatusTone(status)}`}
            >
              {status}
            </span>
            {duration ? (
              <span className="rounded-md border border-current px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] opacity-70">
                {duration}
              </span>
            ) : null}
            {created ? (
              <span className="rounded-md border border-current px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] opacity-70">
                {created}
              </span>
            ) : null}
          </div>
        </div>
        {audioUrl ? (
          <a
            href={audioUrl}
            className="rounded-lg border border-current px-3 py-2 text-xs font-black uppercase tracking-[0.12em] transition hover:bg-white/60"
          >
            Audio
          </a>
        ) : null}
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6">
        {transcript || "No transcript saved."}
      </p>
    </article>
  );
}
