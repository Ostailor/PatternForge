"use client";

import { MAX_TRANSCRIPT_LENGTH } from "@/lib/voice/voiceLimits";

type TranscriptPreviewProps = {
  transcript: string;
  onTranscriptChange?: (transcript: string) => void;
  editable?: boolean;
  label?: string;
  placeholder?: string;
  maxLength?: number;
};

export default function TranscriptPreview({
  transcript,
  onTranscriptChange,
  editable = true,
  label = "Transcript",
  placeholder = "Your transcript will appear here. You can edit it before saving.",
  maxLength = MAX_TRANSCRIPT_LENGTH,
}: TranscriptPreviewProps) {
  const remaining = maxLength - transcript.length;
  const isNearLimit = remaining <= 500;

  return (
    <label className="block">
      <span className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </span>
        <span
          className={`text-xs font-black ${
            remaining < 0
              ? "text-rose-700"
              : isNearLimit
                ? "text-amber-700"
                : "text-slate-500"
          }`}
        >
          {transcript.length.toLocaleString()}/{maxLength.toLocaleString()}
        </span>
      </span>
      <textarea
        value={transcript}
        onChange={(event) => onTranscriptChange?.(event.target.value)}
        readOnly={!editable}
        placeholder={placeholder}
        className="mt-2 min-h-44 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold leading-6 text-slate-700 outline-none transition focus:border-teal-500 focus:bg-white read-only:bg-white"
      />
    </label>
  );
}
