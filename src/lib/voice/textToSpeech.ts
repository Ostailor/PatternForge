import { createSpeechClient } from "@/lib/voice/speechClient";
import type {
  SpeechClient,
  SpeechOperationResult,
  TextToSpeechInput,
  TextToSpeechOutput,
} from "@/lib/voice/types";
import { checkRateLimit } from "@/lib/rate-limit/rateLimit";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/voice/voiceLimits";

function normalizeText(text: string): string {
  return text.trim().replace(/[ \t]+/g, " ");
}

function getErrorName(error: unknown): string | undefined {
  return error instanceof Error ? error.name : undefined;
}

function getTextOnlyFallback(
  message: string,
  error?: unknown,
): SpeechOperationResult<TextToSpeechOutput> {
  return {
    status: "fallback",
    fallbackAction: "text-only",
    message,
    errorName: getErrorName(error),
  };
}

export async function synthesizeInterviewerSpeech(
  input: TextToSpeechInput,
  client: SpeechClient = createSpeechClient(),
): Promise<SpeechOperationResult<TextToSpeechOutput>> {
  const text = normalizeText(input.text);

  if (!text) {
    return getTextOnlyFallback("No interviewer text was provided.");
  }

  if (text.length > MAX_TRANSCRIPT_LENGTH) {
    return getTextOnlyFallback(
      `Interviewer text is longer than ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters. Show text only.`,
    );
  }

  const rateLimit = await checkRateLimit({
    kind: "textToSpeech",
    userProfileId: input.userProfileId ?? null,
    fallbackKey: "anonymous-tts",
  });

  if (!rateLimit.ok) {
    return getTextOnlyFallback(rateLimit.message);
  }

  try {
    return {
      status: "success",
      output: await client.textToSpeech.synthesize({
        ...input,
        text,
      }),
    };
  } catch (error) {
    return getTextOnlyFallback(
      "Text-to-speech failed. Show interviewer text only.",
      error,
    );
  }
}
