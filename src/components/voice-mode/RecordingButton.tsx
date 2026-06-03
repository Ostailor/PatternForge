"use client";

import type { VoiceControlStatus } from "./types";

type RecordingButtonProps = {
  status: VoiceControlStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
};

function getButtonCopy(status: VoiceControlStatus): string {
  switch (status) {
    case "recording":
      return "Stop recording";
    case "processing":
      return "Transcribing...";
    case "unavailable":
      return "Voice unavailable";
    case "saved":
      return "Saved";
    case "permission-needed":
    case "ready":
    case "failed":
      return "Start recording";
  }
}

export default function RecordingButton({
  status,
  onStartRecording,
  onStopRecording,
  disabled = false,
}: RecordingButtonProps) {
  const isRecording = status === "recording";
  const isDisabled =
    disabled ||
    status === "unavailable" ||
    status === "processing" ||
    status === "saved";

  return (
    <button
      type="button"
      onClick={isRecording ? onStopRecording : onStartRecording}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
        isRecording
          ? "border border-rose-200 bg-rose-600 text-white hover:bg-rose-700"
          : "bg-slate-950 text-white hover:bg-teal-700"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${
          isRecording ? "bg-white" : "bg-teal-300"
        }`}
      />
      {getButtonCopy(status)}
    </button>
  );
}
