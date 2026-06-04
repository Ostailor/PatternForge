"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import VoiceControls from "@/components/voice-mode/VoiceControls";
import type { VoiceControlStatus } from "@/components/voice-mode/types";
import {
  MAX_RECORDING_DURATION_MS,
  MAX_TRANSCRIPT_LENGTH,
} from "@/lib/voice/voiceLimits";
import type { InterviewPhase } from "@/generated/prisma/enums";

import {
  abandonVoiceSessionAction,
  transcribeInterviewVoiceTurnAction,
} from "./actions";

type InterviewVoiceModeProps = {
  interviewId: string;
  roundId: string;
  phase: InterviewPhase;
  targetFieldName: string;
  isOptional?: boolean;
  enabled?: boolean;
};

function getInitialStatus(): VoiceControlStatus {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  ) {
    return "unavailable";
  }

  return "permission-needed";
}

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => {
    track.stop();
  });
}

function getFormField(
  form: HTMLFormElement,
  name: string,
): HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null {
  const field = form.elements.namedItem(name);

  return field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
    ? field
    : null;
}

export default function InterviewVoiceMode({
  interviewId,
  roundId,
  phase,
  targetFieldName,
  isOptional = false,
  enabled = true,
}: InterviewVoiceModeProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<Date | null>(null);
  const recordingEndedAtRef = useRef<Date | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const shouldDiscardRecordingRef = useRef(false);

  const [status, setStatus] = useState<VoiceControlStatus>(() => getInitialStatus());
  const [transcript, setTranscript] = useState("");
  const [durationMs, setDurationMs] = useState<number | undefined>();
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [isSkipped, setIsSkipped] = useState(false);

  const updateHiddenField = useCallback((name: string, value: string) => {
    const form = rootRef.current?.closest("form");

    if (!form) {
      return;
    }

    const field = getFormField(form, name);

    if (field) {
      field.value = value;
      return;
    }

    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }, []);

  const applyTranscriptToForm = useCallback(() => {
    const acceptedTranscript = transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);
    const form = rootRef.current?.closest("form");
    const targetField = form ? getFormField(form, targetFieldName) : null;

    if (targetField) {
      targetField.value = acceptedTranscript;
      targetField.dispatchEvent(new Event("input", { bubbles: true }));
      targetField.dispatchEvent(new Event("change", { bubbles: true }));
    }

    updateHiddenField("voiceTranscriptAccepted", "true");
    updateHiddenField("voiceDurationMs", durationMs ? String(durationMs) : "");
    updateHiddenField(
      "voiceStartedAt",
      recordingStartedAtRef.current?.toISOString() ?? "",
    );
    updateHiddenField(
      "voiceEndedAt",
      recordingEndedAtRef.current?.toISOString() ?? "",
    );
    setTranscript(acceptedTranscript);
    setStatus("saved");
    setShowManualFallback(false);
    setErrorMessage(undefined);
  }, [durationMs, targetFieldName, transcript, updateHiddenField]);

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const transcribeBlob = useCallback(
    async (audioBlob: Blob) => {
      if (audioBlob.size === 0) {
        setStatus("failed");
        setShowManualFallback(true);
        setErrorMessage("No audio was captured. Type your answer manually.");
        return;
      }

      setStatus("processing");
      setErrorMessage(undefined);

      const formData = new FormData();
      formData.set("interviewId", interviewId);
      formData.set("roundId", roundId);
      formData.set("phase", phase);
      formData.set("voiceDurationMs", String(durationMs ?? recordingElapsedMs));
      formData.set("audio", audioBlob, "voice-turn.webm");

      const result = await transcribeInterviewVoiceTurnAction(formData);

      if (result.status === "success") {
        setTranscript(result.transcript);
        setDurationMs(result.durationMs ?? durationMs ?? recordingElapsedMs);
        setStatus("ready");
        setShowManualFallback(false);
        return;
      }

      setStatus("failed");
      setShowManualFallback(true);
      setErrorMessage(result.message);
    },
    [durationMs, interviewId, phase, recordingElapsedMs, roundId],
  );

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return;
    }

    recordingEndedAtRef.current = new Date();
    setDurationMs(
      recordingStartedAtRef.current
        ? recordingEndedAtRef.current.getTime() -
            recordingStartedAtRef.current.getTime()
        : undefined,
    );
    mediaRecorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (status === "unavailable") {
      setShowManualFallback(true);
      return;
    }

    try {
      shouldDiscardRecordingRef.current = false;
      chunksRef.current = [];
      setTranscript("");
      setDurationMs(undefined);
      setRecordingElapsedMs(0);
      setShowManualFallback(false);
      setErrorMessage(undefined);
      updateHiddenField("voiceTranscriptAccepted", "");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      recordingStartedAtRef.current = new Date();
      recordingEndedAtRef.current = null;

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      });
      mediaRecorder.addEventListener("stop", () => {
        clearRecordingTimer();
        stopStream(streamRef.current);
        streamRef.current = null;
        mediaRecorderRef.current = null;

        if (shouldDiscardRecordingRef.current) {
          setStatus("permission-needed");
          setRecordingElapsedMs(0);
          return;
        }

        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        void transcribeBlob(audioBlob);
      });

      mediaRecorder.start();
      setStatus("recording");
      recordingTimerRef.current = window.setInterval(() => {
        const elapsed = recordingStartedAtRef.current
          ? Date.now() - recordingStartedAtRef.current.getTime()
          : 0;

        setRecordingElapsedMs(elapsed);

        if (elapsed >= MAX_RECORDING_DURATION_MS) {
          stopRecording();
        }
      }, 500);
    } catch {
      setStatus("failed");
      setShowManualFallback(true);
      setErrorMessage("Microphone access failed. Type your answer manually.");
    }
  }, [clearRecordingTimer, status, stopRecording, transcribeBlob, updateHiddenField]);

  const cancelRecording = useCallback(() => {
    shouldDiscardRecordingRef.current = true;
    stopRecording();
    clearRecordingTimer();
    stopStream(streamRef.current);
    streamRef.current = null;
    chunksRef.current = [];
    setRecordingElapsedMs(0);
    setDurationMs(undefined);
    setStatus(getInitialStatus());
  }, [clearRecordingTimer, stopRecording]);

  const retryTranscription = useCallback(() => {
    setTranscript("");
    setDurationMs(undefined);
    setShowManualFallback(false);
    setErrorMessage(undefined);
    setStatus(getInitialStatus());
  }, []);

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopStream(streamRef.current);
    };
  }, [clearRecordingTimer]);

  if (!enabled) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Voice Mode
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Voice Mode is turned off for this beta environment. Type your answer
          manually to continue.
        </p>
      </div>
    );
  }

  if (isSkipped) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Voice skipped
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
              Continue this phase with text. Voice Mode is optional for every
              interview phase.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsSkipped(false)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
          >
            Use voice
          </button>
        </div>
      </section>
    );
  }

  return (
    <div ref={rootRef} className="space-y-3">
      <VoiceControls
        status={status}
        transcript={transcript}
        onStartRecording={startRecording}
        onStopRecording={stopRecording}
        onCancelRecording={cancelRecording}
        onSubmitTranscript={applyTranscriptToForm}
        onRetryTranscription={retryTranscription}
        onTranscriptChange={setTranscript}
        onTypeManually={() => {
          setShowManualFallback(true);
        }}
        onDismissManualFallback={() => setShowManualFallback(false)}
        showManualFallback={showManualFallback}
        recordingElapsedMs={recordingElapsedMs}
        errorMessage={errorMessage}
      />
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-bold leading-5 text-slate-600">
          {isOptional
            ? "Narration is optional for this phase. Continue with code or text when voice is not useful."
            : "Submit the transcript here, then continue the phase when the text looks right."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              cancelRecording();
              setIsSkipped(true);
            }}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Skip voice for this phase
          </button>
          <button
            type="submit"
            formAction={abandonVoiceSessionAction}
            className="rounded-md border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50"
          >
            Abandon voice session
          </button>
        </div>
      </div>
    </div>
  );
}
