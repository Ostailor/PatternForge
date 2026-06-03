import { createSpeechClient } from "@/lib/voice/speechClient";
import type {
  SpeechClient,
  SpeechOperationResult,
  TranscriptionInput,
  TranscriptionOutput,
} from "@/lib/voice/types";
import {
  MAX_TRANSCRIPT_LENGTH,
  isRecordingDurationAllowed,
  isTranscriptLengthAllowed,
} from "@/lib/voice/voiceLimits";

function hasAudioSource(input: TranscriptionInput): boolean {
  return Boolean(input.audioBlob || input.audioFileRef);
}

function normalizeTranscript(transcript: string): string {
  return transcript.trim().replace(/[ \t]+/g, " ");
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function getManualFallback(
  message: string,
  error?: unknown,
): SpeechOperationResult<TranscriptionOutput> {
  return {
    status: "fallback",
    fallbackAction: "manual-transcript",
    message,
    errorName: getErrorName(error),
  };
}

export async function transcribeInterviewTurn(
  input: TranscriptionInput,
  client: SpeechClient = createSpeechClient(),
): Promise<SpeechOperationResult<TranscriptionOutput>> {
  if (!hasAudioSource(input)) {
    return getManualFallback(
      "No audio was provided. Let the user type their answer manually.",
    );
  }

  if (!isRecordingDurationAllowed(input.durationMs)) {
    return getManualFallback(
      "Recording is longer than the per-turn limit. Let the user type or shorten their answer.",
    );
  }

  try {
    const output = await client.speechToText.transcribe(input);
    const transcript = normalizeTranscript(output.transcript);

    if (!transcript) {
      return getManualFallback(
        "Speech-to-text returned an empty transcript. Let the user type their answer manually.",
      );
    }

    if (!isTranscriptLengthAllowed(transcript)) {
      return getManualFallback(
        `Transcript is longer than ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters. Let the user edit it before saving.`,
      );
    }

    return {
      status: "success",
      output: {
        ...output,
        transcript,
      },
    };
  } catch (error) {
    return getManualFallback(
      "Speech-to-text failed. Let the user type their answer manually.",
      error,
    );
  }
}

export function createManualTranscriptionOutput({
  transcript,
  durationMs,
}: {
  transcript: string;
  durationMs?: number;
}): TranscriptionOutput {
  const normalizedTranscript = normalizeTranscript(transcript);

  if (!normalizedTranscript) {
    throw new Error("Manual transcript is required.");
  }

  if (!isTranscriptLengthAllowed(normalizedTranscript)) {
    throw new Error(
      `Manual transcript must be ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters or fewer.`,
    );
  }

  return {
    transcript: normalizedTranscript,
    durationMs,
    providerMetadata: {
      provider: "manual",
      mode: "typed-fallback",
    },
  };
}
