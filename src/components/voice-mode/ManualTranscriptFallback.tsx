"use client";

import TranscriptPreview from "./TranscriptPreview";

type ManualTranscriptFallbackProps = {
  transcript: string;
  onTranscriptChange: (transcript: string) => void;
  onSubmitTranscript: () => void;
  onCancel?: () => void;
  reason?: string;
  isSubmitting?: boolean;
};

export default function ManualTranscriptFallback({
  transcript,
  onTranscriptChange,
  onSubmitTranscript,
  onCancel,
  reason = "Voice is optional. You can type the answer and continue the interview.",
  isSubmitting = false,
}: ManualTranscriptFallbackProps) {
  const canSubmit = transcript.trim().length > 0 && !isSubmitting;

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-amber-700">
        Text fallback
      </p>
      <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">
        Type your answer manually
      </h3>
      <p className="mt-2 text-sm font-bold leading-6 text-amber-800">
        {reason}
      </p>
      <div className="mt-4">
        <TranscriptPreview
          transcript={transcript}
          onTranscriptChange={onTranscriptChange}
          label="Manual transcript"
          placeholder="Type what you would say out loud to the interviewer."
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onSubmitTranscript}
          disabled={!canSubmit}
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Saving..." : "Submit transcript"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </section>
  );
}
