"use client";

type InterviewerSpeechToggleProps = {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  isAvailable?: boolean;
  isSpeaking?: boolean;
  onReplay?: () => void;
};

export default function InterviewerSpeechToggle({
  enabled,
  onEnabledChange,
  isAvailable = true,
  isSpeaking = false,
  onReplay,
}: InterviewerSpeechToggleProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Speak interviewer responses
          </p>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
            {isAvailable
              ? "Hear interviewer prompts when speech is available."
              : "Speech playback is unavailable. Interviewer text remains visible."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEnabledChange(!enabled)}
            disabled={!isAvailable}
            aria-pressed={enabled}
            className={`rounded-lg border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
              enabled
                ? "border-teal-200 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
            }`}
          >
            {enabled ? "Speak interviewer responses: on" : "Speak interviewer responses"}
          </button>
          {onReplay ? (
            <button
              type="button"
              onClick={onReplay}
              disabled={!enabled || !isAvailable || isSpeaking}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSpeaking ? "Playing..." : "Replay"}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
