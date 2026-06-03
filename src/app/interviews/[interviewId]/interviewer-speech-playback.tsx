"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import InterviewerSpeechToggle from "@/components/voice-mode/InterviewerSpeechToggle";
import {
  isInterviewerSpeechPlaybackAvailable,
  speakInterviewerText,
  stopInterviewerSpeechPlayback,
} from "@/lib/voice/interviewerSpeechPlayback";
import type { InterviewMessageRole, InterviewPhase } from "@/generated/prisma/enums";

type SpeakableInterviewMessage = {
  id: string;
  role: InterviewMessageRole;
  phase: InterviewPhase;
  content: string;
};

type InterviewerSpeechPlaybackProps = {
  phase: InterviewPhase;
  phaseInstruction?: string;
  messages?: SpeakableInterviewMessage[];
  feedbackSummary?: string | null;
  followUpRecommendations?: string[];
};

type SpeechItem = {
  id: string;
  text: string;
};

function hasText(value: string | null | undefined): value is string {
  return Boolean(value?.trim());
}

function buildFeedbackSpeechText({
  feedbackSummary,
  followUpRecommendations,
}: {
  feedbackSummary?: string | null;
  followUpRecommendations?: string[];
}): string {
  return [
    feedbackSummary,
    followUpRecommendations?.length
      ? `Follow-up recommendations: ${followUpRecommendations.join(". ")}`
      : "",
  ]
    .filter(hasText)
    .join("\n\n");
}

export default function InterviewerSpeechPlayback({
  phase,
  phaseInstruction,
  messages = [],
  feedbackSummary,
  followUpRecommendations = [],
}: InterviewerSpeechPlaybackProps) {
  const lastSpokenItemIdRef = useRef<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAvailable] = useState(() => isInterviewerSpeechPlaybackAvailable());

  const speechItems = useMemo<SpeechItem[]>(() => {
    const phaseItems: SpeechItem[] = hasText(phaseInstruction)
      ? [
          {
            id: `phase:${phase}`,
            text: phaseInstruction,
          },
        ]
      : [];
    const interviewerItems = messages
      .filter((message) => message.role === "Interviewer" && hasText(message.content))
      .map((message) => ({
        id: `message:${message.id}`,
        text: message.content,
      }));
    const feedbackSpeechText = buildFeedbackSpeechText({
      feedbackSummary,
      followUpRecommendations,
    });
    const feedbackItems: SpeechItem[] = feedbackSpeechText
      ? [
          {
            id: "feedback:summary",
            text: feedbackSpeechText,
          },
        ]
      : [];

    return [...phaseItems, ...interviewerItems, ...feedbackItems];
  }, [feedbackSummary, followUpRecommendations, messages, phase, phaseInstruction]);
  const latestSpeechItem = speechItems.at(-1) ?? null;

  const playLatest = useCallback(() => {
    if (!latestSpeechItem || !isAvailable) {
      return;
    }

    const didStart = speakInterviewerText({ text: latestSpeechItem.text });

    if (!didStart) {
      setIsSpeaking(false);
      return;
    }

    lastSpokenItemIdRef.current = latestSpeechItem.id;
    setIsSpeaking(true);
    window.setTimeout(() => setIsSpeaking(false), 750);
  }, [isAvailable, latestSpeechItem]);

  useEffect(() => {
    return () => {
      stopInterviewerSpeechPlayback();
    };
  }, []);

  useEffect(() => {
    if (!enabled || !latestSpeechItem) {
      return;
    }

    if (lastSpokenItemIdRef.current === latestSpeechItem.id) {
      return;
    }

    playLatest();
  }, [enabled, latestSpeechItem, playLatest]);

  return (
    <InterviewerSpeechToggle
      enabled={enabled}
      onEnabledChange={(nextEnabled) => {
        setEnabled(nextEnabled);

        if (!nextEnabled) {
          stopInterviewerSpeechPlayback();
          setIsSpeaking(false);
          return;
        }

        playLatest();
      }}
      isAvailable={isAvailable}
      isSpeaking={isSpeaking}
      onReplay={latestSpeechItem ? playLatest : undefined}
    />
  );
}
