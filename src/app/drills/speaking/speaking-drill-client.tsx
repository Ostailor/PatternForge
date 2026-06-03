"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import VoiceControls from "@/components/voice-mode/VoiceControls";
import type { VoiceControlStatus } from "@/components/voice-mode/types";
import {
  MAX_RECORDING_DURATION_MS,
  MAX_TRANSCRIPT_LENGTH,
} from "@/lib/voice/voiceLimits";

import {
  createSpeakingPracticeFlashcardAction,
  createSpeakingPracticeMistakeAction,
  scoreSpeakingDrillAction,
  transcribeSpeakingDrillAction,
} from "./actions";
import type {
  SpeakingDrillPrompt,
  SpeakingDrillType,
  SpeakingScoreResult,
  SpeakingStudyCardActionResult,
} from "./types";

type SpeakingDrillClientProps = {
  prompts: SpeakingDrillPrompt[];
  initialDrillType: SpeakingDrillType;
  patterns: Array<{
    id: string;
    name: string;
  }>;
};

const drillTypeLabels: Record<SpeakingDrillType, string> = {
  pattern: "Explain a Pattern",
  approach: "Explain an Approach",
  debugging: "Explain a Debugging Failure",
  complexity: "Explain Complexity",
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

function scoreAverage(feedback: SpeakingScoreResult): number {
  return Math.round(
    (feedback.clarityScore +
      feedback.structureScore +
      feedback.concisenessScore +
      feedback.confidenceScore +
      feedback.technicalExplanationScore) /
      5,
  );
}

function formatDuration(durationMs: number | undefined): string {
  if (!durationMs) {
    return "Not recorded";
  }

  const seconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function SpeakingDrillClient({
  prompts,
  initialDrillType,
  patterns,
}: SpeakingDrillClientProps) {
  const router = useRouter();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<Date | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const shouldDiscardRecordingRef = useRef(false);

  const [selectedDrillType, setSelectedDrillType] =
    useState<SpeakingDrillType>(initialDrillType);
  const [status, setStatus] = useState<VoiceControlStatus>(() => getInitialStatus());
  const [transcript, setTranscript] = useState("");
  const [durationMs, setDurationMs] = useState<number | undefined>();
  const [recordingElapsedMs, setRecordingElapsedMs] = useState(0);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<SpeakingScoreResult | null>(null);
  const [isScoring, setIsScoring] = useState(false);
  const [studyCardState, setStudyCardState] =
    useState<SpeakingStudyCardActionResult | null>(null);

  const selectedPrompt =
    prompts.find((prompt) => prompt.drillType === selectedDrillType) ??
    prompts[0];
  const selectedPatternId = prompts.find(
    (prompt) => prompt.drillType === "pattern",
  )?.patternId;

  const canCreateMistake = Boolean(selectedPrompt.attemptId);
  const scoreMetrics = useMemo(
    () =>
      feedback
        ? [
            { label: "Clarity", value: feedback.clarityScore },
            { label: "Structure", value: feedback.structureScore },
            { label: "Conciseness", value: feedback.concisenessScore },
            { label: "Confidence", value: feedback.confidenceScore },
            {
              label: "Technical explanation",
              value: feedback.technicalExplanationScore,
            },
          ]
        : [],
    [feedback],
  );

  const clearRecordingTimer = useCallback(() => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  const resetAnswer = useCallback(() => {
    setTranscript("");
    setDurationMs(undefined);
    setRecordingElapsedMs(0);
    setShowManualFallback(false);
    setErrorMessage(undefined);
    setFeedback(null);
    setStudyCardState(null);
    setStatus(getInitialStatus());
  }, []);

  const selectDrillType = useCallback(
    (drillType: SpeakingDrillType) => {
      setSelectedDrillType(drillType);
      resetAnswer();
    },
    [resetAnswer],
  );

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
      formData.set("drillType", selectedPrompt.drillType);
      formData.set("durationMs", String(durationMs ?? recordingElapsedMs));
      formData.set("audio", audioBlob, "speaking-practice.webm");

      const result = await transcribeSpeakingDrillAction(formData);

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
    [durationMs, recordingElapsedMs, selectedPrompt.drillType],
  );

  const stopRecording = useCallback(() => {
    const mediaRecorder = mediaRecorderRef.current;

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      return;
    }

    const endedAt = new Date();
    setDurationMs(
      recordingStartedAtRef.current
        ? endedAt.getTime() - recordingStartedAtRef.current.getTime()
        : undefined,
    );
    mediaRecorder.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (!selectedPrompt.isAvailable) {
      setErrorMessage(selectedPrompt.unavailableReason);
      return;
    }

    if (status === "unavailable") {
      setShowManualFallback(true);
      return;
    }

    try {
      shouldDiscardRecordingRef.current = false;
      chunksRef.current = [];
      setTranscript("");
      setFeedback(null);
      setStudyCardState(null);
      setDurationMs(undefined);
      setRecordingElapsedMs(0);
      setShowManualFallback(false);
      setErrorMessage(undefined);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;
      recordingStartedAtRef.current = new Date();

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
  }, [
    clearRecordingTimer,
    selectedPrompt.isAvailable,
    selectedPrompt.unavailableReason,
    status,
    stopRecording,
    transcribeBlob,
  ]);

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
    setFeedback(null);
    setStudyCardState(null);
    setShowManualFallback(false);
    setErrorMessage(undefined);
    setStatus(getInitialStatus());
  }, []);

  const submitTranscript = useCallback(async () => {
    const acceptedTranscript = transcript.trim().slice(0, MAX_TRANSCRIPT_LENGTH);

    if (!acceptedTranscript || !selectedPrompt.isAvailable) {
      setErrorMessage(
        selectedPrompt.unavailableReason ?? "Add a transcript before scoring.",
      );
      return;
    }

    setIsScoring(true);
    setErrorMessage(undefined);
    setStudyCardState(null);

    const result = await scoreSpeakingDrillAction({
      prompt: selectedPrompt,
      transcript: acceptedTranscript,
      durationMs,
    });

    setIsScoring(false);

    if (result.status !== "success") {
      setErrorMessage(result.message);
      return;
    }

    setTranscript(acceptedTranscript);
    setFeedback(result.feedback);
    setStatus("saved");
    setShowManualFallback(false);
  }, [durationMs, selectedPrompt, transcript]);

  const createStudyCard = useCallback(
    async (kind: "flashcard" | "mistake") => {
      if (!feedback) {
        return;
      }

      setStudyCardState(null);
      const payload = {
        prompt: selectedPrompt,
        transcript,
        feedbackSummary: feedback.summary,
      };
      const result =
        kind === "flashcard"
          ? await createSpeakingPracticeFlashcardAction(payload)
          : await createSpeakingPracticeMistakeAction(payload);

      setStudyCardState(result);
    },
    [feedback, selectedPrompt, transcript],
  );

  useEffect(() => {
    return () => {
      clearRecordingTimer();
      stopStream(streamRef.current);
    };
  }, [clearRecordingTimer]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Speaking Practice
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            Lightweight voice drills
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            Practice explaining patterns, approaches, debugging failures, and
            complexity out loud without starting a full mock interview.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Mode" value="Transcript-first" />
            <MiniStat label="Limit" value="3 min" />
            <MiniStat label="Audio" value="Not stored" />
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Drill type
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {prompts.map((prompt) => (
              <button
                key={prompt.drillType}
                type="button"
                onClick={() => selectDrillType(prompt.drillType)}
                className={`rounded-lg border px-4 py-3 text-left text-sm font-black transition ${
                  selectedDrillType === prompt.drillType
                    ? "border-teal-300 bg-teal-50 text-teal-700"
                    : "border-slate-200 bg-slate-50 text-slate-700 hover:border-teal-200 hover:bg-teal-50"
                }`}
              >
                {drillTypeLabels[prompt.drillType]}
                {!prompt.isAvailable ? (
                  <span className="mt-1 block text-xs font-bold text-slate-500">
                    Needs history
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {selectedDrillType === "pattern" ? (
            <label className="mt-5 block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Pattern
              </span>
              <select
                value={selectedPatternId}
                onChange={(event) => {
                  router.push(`/drills/speaking?type=pattern&patternId=${event.target.value}`);
                }}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
              >
                {patterns.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </section>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {selectedPrompt.eyebrow}
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {selectedPrompt.title}
          </h2>
          <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
            {selectedPrompt.description}
          </p>

          {!selectedPrompt.isAvailable ? (
            <p className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-4 text-sm font-bold leading-6 text-amber-800">
              {selectedPrompt.unavailableReason}
            </p>
          ) : null}

          <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">
              {selectedPrompt.contextTitle}
            </p>
            <div className="mt-3 grid gap-3">
              {selectedPrompt.contextItems.map((item) => (
                <div key={item.label}>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Your answer should cover
            </p>
            <ul className="mt-3 grid gap-2">
              {selectedPrompt.focusChecklist.map((item) => (
                <li
                  key={item}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="space-y-5">
          <VoiceControls
            status={status}
            transcript={transcript}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onCancelRecording={cancelRecording}
            onSubmitTranscript={submitTranscript}
            onRetryTranscription={retryTranscription}
            onTranscriptChange={(value) => {
              setTranscript(value);
              setFeedback(null);
              setStudyCardState(null);
            }}
            onTypeManually={() => setShowManualFallback(true)}
            onDismissManualFallback={() => setShowManualFallback(false)}
            showManualFallback={showManualFallback}
            recordingElapsedMs={recordingElapsedMs}
            errorMessage={errorMessage}
            disabled={isScoring || !selectedPrompt.isAvailable}
            context="speaking-practice"
          />

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  AI communication feedback
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                  {feedback ? `Score ${scoreAverage(feedback)}%` : "Submit a transcript to score"}
                </h2>
              </div>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                {formatDuration(durationMs)}
              </span>
            </div>

            {isScoring ? (
              <p className="mt-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-bold text-teal-700">
                Scoring your spoken explanation...
              </p>
            ) : null}

            {feedback ? (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {scoreMetrics.map((metric) => (
                    <ScoreTile
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                    />
                  ))}
                </div>

                <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
                  {feedback.summary}
                </p>

                <FeedbackList title="Strengths" items={feedback.strengths} />
                <FeedbackList title="Weaknesses" items={feedback.weaknesses} />
                <FeedbackList
                  title="Suggested improvement"
                  items={feedback.suggestedPractice}
                />

                {feedback.insights.length > 0 ? (
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      Communication insights
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {feedback.insights.map((insight) => (
                        <span
                          key={`${insight.insightType}:${insight.summary}`}
                          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600"
                        >
                          {insight.insightType} · {insight.severity}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void createStudyCard("flashcard")}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
                  >
                    Create flashcard
                  </button>
                  <button
                    type="button"
                    onClick={() => void createStudyCard("mistake")}
                    disabled={!canCreateMistake}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-teal-200 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Create mistake
                  </button>
                  <button
                    type="button"
                    onClick={resetAnswer}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Try again
                  </button>
                </div>

                {!canCreateMistake ? (
                  <p className="text-xs font-semibold leading-5 text-slate-500">
                    Mistake creation is available when the drill is linked to a
                    saved attempt. Flashcards are available for pattern-linked
                    prompts.
                  </p>
                ) : null}

                {studyCardState ? (
                  <p className="rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-bold text-teal-700">
                    {studyCardState.message}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
                Record or type your answer. PatternForge will score the
                transcript only; it will not claim to evaluate vocal tone.
              </p>
            )}
          </section>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold leading-6 text-slate-600">
            Want a full mock with follow-up questions and interview history?
          </p>
          <Link
            href="/interviews?voiceMode=1"
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-teal-200 hover:text-teal-700"
          >
            Start voice interview
          </Link>
        </div>
      </section>
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}%</p>
    </div>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          No specific notes.
        </p>
      ) : (
        <ul className="mt-2 grid gap-2">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
