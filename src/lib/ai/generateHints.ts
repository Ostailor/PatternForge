import "server-only";

import { requestStructuredJson } from "@/lib/ai/client";
import { AIResponseParseError } from "@/lib/ai/errors";
import { HINT_LEVELS } from "@/lib/ai/hints";
import { buildGenerateHintsMessages } from "@/lib/ai/prompts";
import type { AIHintInput, AIHintOutput, HintLevel } from "@/lib/ai/types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readLevel(record: Record<string, unknown>, expectedIndex: number): HintLevel {
  const level = record.level;
  const title = record.title;
  const hint = record.hint;
  const expectedLevel = expectedIndex + 1;
  const expectedTitle = HINT_LEVELS[expectedIndex];

  if (level !== expectedLevel) {
    throw new AIResponseParseError(
      `AI hint level ${expectedLevel} must use level ${expectedLevel}.`,
    );
  }

  if (typeof title !== "string" || title !== expectedTitle) {
    throw new AIResponseParseError(
      `AI hint level ${expectedLevel} must use title "${expectedTitle}".`,
    );
  }

  if (typeof hint !== "string" || !hint.trim()) {
    throw new AIResponseParseError(
      `AI hint level ${expectedLevel} must include hint text.`,
    );
  }

  return {
    level: level as HintLevel["level"],
    title,
    hint: hint.trim(),
  };
}

function readLevels(record: Record<string, unknown>): HintLevel[] {
  const value = record.levels;

  if (!Array.isArray(value) || value.length !== HINT_LEVELS.length) {
    throw new AIResponseParseError(
      'AI response field "levels" must include exactly five hints.',
    );
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError("Each AI hint level must be an object.");
    }

    return readLevel(item, index);
  });
}

export function parseAIHintOutput(value: unknown): AIHintOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError("AI hint response must be a JSON object.");
  }

  return {
    levels: readLevels(value),
  };
}

export async function generateHints(
  input: AIHintInput,
): Promise<AIHintOutput> {
  const response = await requestStructuredJson({
    messages: buildGenerateHintsMessages(input),
    temperature: 0.25,
    maxTokens: 800,
  });

  return parseAIHintOutput(response);
}
