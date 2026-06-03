"use client";

import { MAX_TRANSCRIPT_LENGTH } from "@/lib/voice/voiceLimits";

type SpeakInterviewerTextInput = {
  text: string;
  voiceName?: string;
  speed?: number;
};

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function normalizeSpeechText(text: string): string {
  return text.trim().replace(/[ \t]+/g, " ").slice(0, MAX_TRANSCRIPT_LENGTH);
}

function chooseVoice(voiceName: string | undefined): SpeechSynthesisVoice | null {
  const speechSynthesis = getSpeechSynthesis();

  if (!speechSynthesis || !voiceName) {
    return null;
  }

  return (
    speechSynthesis
      .getVoices()
      .find((voice) => voice.name === voiceName || voice.voiceURI === voiceName) ??
    null
  );
}

export function isInterviewerSpeechPlaybackAvailable(): boolean {
  return Boolean(
    getSpeechSynthesis() && typeof SpeechSynthesisUtterance !== "undefined",
  );
}

export function stopInterviewerSpeechPlayback() {
  try {
    getSpeechSynthesis()?.cancel();
  } catch {
    // Speech playback is optional and must not interrupt the interview.
  }
}

export function speakInterviewerText({
  text,
  voiceName,
  speed = 1,
}: SpeakInterviewerTextInput): boolean {
  const speechSynthesis = getSpeechSynthesis();
  const normalizedText = normalizeSpeechText(text);

  if (
    !speechSynthesis ||
    !normalizedText ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return false;
  }

  try {
    speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(normalizedText);
    const selectedVoice = chooseVoice(voiceName);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = Math.max(0.6, Math.min(1.4, speed));
    utterance.pitch = 1;
    speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}
