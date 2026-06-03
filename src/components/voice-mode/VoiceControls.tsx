"use client";

import {
  MAX_RECORDING_DURATION_MS,
  MAX_TRANSCRIPT_LENGTH,
} from "@/lib/voice/voiceLimits";

import ManualTranscriptFallback from "./ManualTranscriptFallback";
import RecordingButton from "./RecordingButton";
import TranscriptPreview from "./TranscriptPreview";
import type { VoiceControlStatus } from "./types";
import { VOICE_MODE_PRIVACY_COPY } from "./VoiceModeBanner";

type VoiceControlsProps = {
  status: VoiceControlStatus;
  transcript: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onSubmitTranscript: () => void;
  onRetryTranscription: () => void;
  onTranscriptChange: (transcript: string) => void;
  onTypeManually: () => void;
  onDismissManualFallback?: () => void;
  showManualFallback?: boolean;
  recordingElapsedMs?: number;
  errorMessage?: string;
  disabled?: boolean;
  context?: "interview" | "speaking-practice";
};

function getStatusCopy(status: VoiceControlStatus, context: VoiceControlsProps["context"]): {
  title: string;
  detail: string;
} {
  const isSpeakingPractice = context === "speaking-practice";

  switch (status) {
    case "unavailable":
      return {
        title: "Voice unavailable",
        detail: isSpeakingPractice
          ? "Continue with the text fallback. Speaking practice still works."
          : "Continue with the text fallback. Interview Mode still works.",
      };
    case "permission-needed":
      return {
        title: "Microphone permission needed",
        detail: "Start recording when you are ready, or type manually.",
      };
    case "recording":
      return {
        title: "Recording",
        detail: isSpeakingPractice
          ? "Explain your answer out loud, then review the transcript."
          : "Explain your reasoning as you would in a real interview.",
      };
    case "processing":
      return {
        title: "Processing transcription",
        detail: "PatternForge is preparing a transcript. You can still type manually if needed.",
      };
    case "ready":
      return {
        title: "Transcript ready",
        detail: "Review and edit the transcript before saving it.",
      };
    case "failed":
      return {
        title: "Transcription failed",
        detail: "Retry transcription or type the answer manually.",
      };
    case "saved":
      return {
        title: "Saved",
        detail: isSpeakingPractice
          ? "Transcript submitted for communication feedback."
          : "Transcript saved for interview feedback.",
      };
  }
}

function formatElapsed(value: number | undefined): string {
  const elapsedSeconds = Math.max(0, Math.round((value ?? 0) / 1000));
  const limitSeconds = Math.round(MAX_RECORDING_DURATION_MS / 1000);

  return `${elapsedSeconds}s / ${limitSeconds}s`;
}

export default function VoiceControls({
  status,
  transcript,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onSubmitTranscript,
  onRetryTranscription,
  onTranscriptChange,
  onTypeManually,
  onDismissManualFallback,
  showManualFallback = false,
  recordingElapsedMs,
  errorMessage,
  disabled = false,
  context = "interview",
}: VoiceControlsProps) {
  const copy = getStatusCopy(status, context);
  const canSubmit =
    status === "ready" &&
    transcript.trim().length > 0 &&
    transcript.length <= MAX_TRANSCRIPT_LENGTH &&
    !disabled;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Voice controls
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {copy.title}
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            {copy.detail}
          </p>
        </div>
        {status === "recording" ? (
          <span className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-rose-700">
            {formatElapsed(recordingElapsedMs)}
          </span>
        ) : null}
      </div>

      <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600">
        {VOICE_MODE_PRIVACY_COPY}
      </p>

      <div className="mt-5 flex flex-wrap gap-3">
        <RecordingButton
          status={status}
          onStartRecording={onStartRecording}
          onStopRecording={onStopRecording}
          disabled={disabled}
        />
        {status === "recording" ? (
          <button
            type="button"
            onClick={onCancelRecording}
            disabled={disabled}
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel recording
          </button>
        ) : null}
        {status === "failed" ? (
          <button
            type="button"
            onClick={onRetryTranscription}
            disabled={disabled}
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Retry transcription
          </button>
        ) : null}
        <button
          type="button"
          onClick={onTypeManually}
          disabled={disabled}
          className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Type manually instead
        </button>
      </div>

      {errorMessage || status === "failed" ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold leading-6 text-rose-700">
          {errorMessage ?? "Transcription failed. Use retry or text fallback."}
        </p>
      ) : null}

      {status === "ready" || status === "saved" ? (
        <div className="mt-5">
          <TranscriptPreview
            transcript={transcript}
            onTranscriptChange={onTranscriptChange}
            editable={status !== "saved" && !disabled}
          />
          {status === "ready" ? (
            <button
              type="button"
              onClick={onSubmitTranscript}
              disabled={!canSubmit}
              className="mt-4 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Submit transcript
            </button>
          ) : null}
        </div>
      ) : null}

      {showManualFallback ? (
        <div className="mt-5">
          <ManualTranscriptFallback
            transcript={transcript}
            onTranscriptChange={onTranscriptChange}
            onSubmitTranscript={onSubmitTranscript}
            onCancel={onDismissManualFallback}
            isSubmitting={disabled}
          />
        </div>
      ) : null}
    </section>
  );
}
