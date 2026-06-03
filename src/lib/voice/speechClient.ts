import "server-only";

import type {
  SpeechClient,
  SpeechToTextProvider,
  TextToSpeechInput,
  TextToSpeechOutput,
  TextToSpeechProvider,
  TranscriptionInput,
  TranscriptionOutput,
  VoiceProviderName,
} from "@/lib/voice/types";
import {
  SpeechConfigurationError,
  SpeechProviderError,
} from "@/lib/voice/types";

type SpeechProviderConfig = {
  provider: VoiceProviderName;
};

function readVoiceProviderName(): VoiceProviderName {
  const provider = process.env.SPEECH_PROVIDER ?? "mock";

  if (provider === "mock" || provider === "local") {
    return provider;
  }

  throw new SpeechConfigurationError(
    `Unsupported SPEECH_PROVIDER "${provider}". Use "mock" or "local".`,
  );
}

function getSpeechProviderConfig(): SpeechProviderConfig {
  return {
    provider: readVoiceProviderName(),
  };
}

function estimateSpeechDurationMs(text: string, speed = 1): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const wordsPerMinute = Math.max(80, Math.min(260, 155 * speed));

  return Math.max(500, Math.round((words / wordsPerMinute) * 60_000));
}

function getMockTranscript(input: TranscriptionInput): string {
  return (
    input.audioFileRef?.mockTranscript ??
    (typeof input.audioFileRef?.providerMetadata?.mockTranscript === "string"
      ? input.audioFileRef.providerMetadata.mockTranscript
      : "")
  ).trim();
}

function createMockSpeechToTextProvider(): SpeechToTextProvider {
  return {
    name: "mock",
    async transcribe(input): Promise<TranscriptionOutput> {
      const transcript = getMockTranscript(input);

      if (!transcript) {
        throw new SpeechProviderError(
          "Mock speech-to-text needs audioFileRef.mockTranscript or providerMetadata.mockTranscript.",
        );
      }

      return {
        transcript,
        confidence: 1,
        durationMs: input.durationMs,
        providerMetadata: {
          provider: "mock",
          mode: "transcript-first",
        },
      };
    },
  };
}

function createMockTextToSpeechProvider(): TextToSpeechProvider {
  return {
    name: "mock",
    async synthesize(input: TextToSpeechInput): Promise<TextToSpeechOutput> {
      return {
        durationMs: estimateSpeechDurationMs(input.text, input.speed),
      };
    },
  };
}

function createLocalSpeechToTextProvider(): SpeechToTextProvider {
  return {
    name: "local",
    async transcribe(input): Promise<TranscriptionOutput> {
      const transcript = getMockTranscript(input);

      if (!transcript) {
        throw new SpeechProviderError(
          "Local speech-to-text is not configured. Submit a manual transcript fallback.",
        );
      }

      return {
        transcript,
        confidence: 1,
        durationMs: input.durationMs,
        providerMetadata: {
          provider: "local",
          mode: "manual-transcript",
        },
      };
    },
  };
}

function createLocalTextToSpeechProvider(): TextToSpeechProvider {
  return {
    name: "local",
    async synthesize(): Promise<TextToSpeechOutput> {
      throw new SpeechProviderError(
        "Local text-to-speech is not configured. Show interviewer text only.",
      );
    },
  };
}

export function createSpeechClient(
  config: SpeechProviderConfig = getSpeechProviderConfig(),
): SpeechClient {
  switch (config.provider) {
    case "mock":
      return {
        speechToText: createMockSpeechToTextProvider(),
        textToSpeech: createMockTextToSpeechProvider(),
      };
    case "local":
      return {
        speechToText: createLocalSpeechToTextProvider(),
        textToSpeech: createLocalTextToSpeechProvider(),
      };
  }
}
