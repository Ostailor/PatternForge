"use client";

import type { VoiceControlStatus } from "./types";
import { VOICE_MODE_PRIVACY_COPY } from "@/lib/voice/voicePrivacy";

type VoiceModeBannerProps = {
  status: VoiceControlStatus;
  title?: string;
  detail?: string;
};

function getStatusLabel(status: VoiceControlStatus): string {
  switch (status) {
    case "unavailable":
      return "Voice unavailable";
    case "permission-needed":
      return "Permission needed";
    case "recording":
      return "Recording";
    case "processing":
      return "Processing";
    case "ready":
      return "Transcript ready";
    case "failed":
      return "Transcription failed";
    case "saved":
      return "Saved";
  }
}

function getTone(status: VoiceControlStatus): string {
  switch (status) {
    case "recording":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "processing":
    case "permission-needed":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ready":
    case "saved":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "failed":
    case "unavailable":
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function VoiceModeBanner({
  status,
  title = "Voice Mode",
  detail = "Practice explaining your thought process out loud while keeping the normal text interview flow available.",
}: VoiceModeBannerProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {title}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Spoken interview practice
          </h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            {detail}
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${getTone(status)}`}
        >
          {getStatusLabel(status)}
        </span>
      </div>
      <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-600">
        {VOICE_MODE_PRIVACY_COPY}
      </p>
    </section>
  );
}
export { VOICE_MODE_PRIVACY_COPY };
