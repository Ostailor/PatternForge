"use client";

import { useEffect, useState } from "react";

type InterviewTimerProps = {
  startedAt: string;
  durationMinutes: number;
  initialSecondsRemaining: number;
  isRunning: boolean;
};

function formatTimer(seconds: number): string {
  const absoluteSeconds = Math.abs(seconds);
  const minutes = Math.floor(absoluteSeconds / 60);
  const remainingSeconds = absoluteSeconds % 60;

  return `${seconds < 0 ? "+" : ""}${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export default function InterviewTimer({
  startedAt,
  durationMinutes,
  initialSecondsRemaining,
  isRunning,
}: InterviewTimerProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(
    initialSecondsRemaining,
  );

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    function updateTimer() {
      const startedAtMs = new Date(startedAt).getTime();
      const elapsedSeconds = Math.floor((Date.now() - startedAtMs) / 1000);
      const totalSeconds = durationMinutes * 60;

      setSecondsRemaining(totalSeconds - elapsedSeconds);
    }

    updateTimer();
    const intervalId = window.setInterval(updateTimer, 1000);

    return () => window.clearInterval(intervalId);
  }, [durationMinutes, isRunning, startedAt]);

  return (
    <div
      className={`rounded-lg border p-4 ${
        secondsRemaining < 0
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : "border-slate-200 bg-white text-slate-950"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        Timer
      </p>
      <p className="mt-2 text-3xl font-black tabular-nums">
        {formatTimer(secondsRemaining)}
      </p>
      <p className="mt-1 text-xs font-bold text-slate-500">
        {secondsRemaining < 0 ? "Over target" : "Remaining"}
      </p>
    </div>
  );
}
