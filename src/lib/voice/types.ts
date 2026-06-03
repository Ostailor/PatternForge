import type { InterviewPhase } from "@/generated/prisma/enums";

export type VoiceProviderName = "mock" | "local";

export type AudioFileRef = {
  url?: string;
  storageKey?: string;
  mimeType?: string;
  sizeBytes?: number;
  mockTranscript?: string;
  providerMetadata?: Record<string, unknown>;
};

export type TranscriptionInput = {
  audioBlob?: Blob;
  audioFileRef?: AudioFileRef;
  language?: string;
  durationMs?: number;
  phase: InterviewPhase;
  interviewSessionId: string;
  interviewRoundId?: string;
};

export type TranscriptionOutput = {
  transcript: string;
  confidence?: number;
  durationMs?: number;
  providerMetadata?: Record<string, unknown>;
};

export type TextToSpeechInput = {
  text: string;
  voice?: string;
  speed?: number;
};

export type TextToSpeechOutput = {
  audioUrl?: string;
  audioBlob?: Blob;
  durationMs?: number;
};

export type SpeechFallbackAction = "manual-transcript" | "text-only";

export type SpeechOperationResult<TOutput> =
  | {
      status: "success";
      output: TOutput;
    }
  | {
      status: "fallback";
      fallbackAction: SpeechFallbackAction;
      message: string;
      errorName?: string;
    };

export type SpeechToTextProvider = {
  name: VoiceProviderName;
  transcribe(input: TranscriptionInput): Promise<TranscriptionOutput>;
};

export type TextToSpeechProvider = {
  name: VoiceProviderName;
  synthesize(input: TextToSpeechInput): Promise<TextToSpeechOutput>;
};

export type SpeechClient = {
  speechToText: SpeechToTextProvider;
  textToSpeech: TextToSpeechProvider;
};

export class SpeechConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechConfigurationError";
  }
}

export class SpeechProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpeechProviderError";
  }
}
