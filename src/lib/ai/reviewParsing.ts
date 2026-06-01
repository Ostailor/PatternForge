import { AIResponseParseError } from "@/lib/ai/errors";
import type {
  AIReviewOutput,
  SuggestedFlashcard,
  SuggestedMistake,
} from "@/lib/ai/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new AIResponseParseError(`AI response field "${key}" must be text.`);
  }

  return value.trim();
}

function readScore(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 10
  ) {
    throw new AIResponseParseError(
      `AI response field "${key}" must be an integer from 1 to 10.`,
    );
  }

  return value;
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new AIResponseParseError(
      `AI response field "${key}" must be a list of strings.`,
    );
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function readSuggestedMistakes(
  record: Record<string, unknown>,
): SuggestedMistake[] {
  const value = record.suggestedMistakes;

  if (!Array.isArray(value)) {
    throw new AIResponseParseError(
      'AI response field "suggestedMistakes" must be a list.',
    );
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError(
        "Each suggested mistake must be an object.",
      );
    }

    return {
      mistakeType: readString(item, "mistakeType"),
      description: readString(item, "description"),
      correction: readString(item, "correction"),
    };
  });
}

function readSuggestedFlashcards(
  record: Record<string, unknown>,
): SuggestedFlashcard[] {
  const value = record.suggestedFlashcards;

  if (!Array.isArray(value)) {
    throw new AIResponseParseError(
      'AI response field "suggestedFlashcards" must be a list.',
    );
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError(
        "Each suggested flashcard must be an object.",
      );
    }

    return {
      front: readString(item, "front"),
      back: readString(item, "back"),
    };
  });
}

export function parseAIReviewOutput(value: unknown): AIReviewOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError("AI review response must be a JSON object.");
  }

  return {
    patternScore: readScore(value, "patternScore"),
    implementationScore: readScore(value, "implementationScore"),
    complexityScore: readScore(value, "complexityScore"),
    explanationScore: readScore(value, "explanationScore"),
    feedbackSummary: readString(value, "feedbackSummary"),
    strengths: readStringArray(value, "strengths"),
    weaknesses: readStringArray(value, "weaknesses"),
    complexityFeedback: readString(value, "complexityFeedback"),
    suggestedMistakes: readSuggestedMistakes(value),
    suggestedFlashcards: readSuggestedFlashcards(value),
    suggestedNextStep: readString(value, "suggestedNextStep"),
  };
}
