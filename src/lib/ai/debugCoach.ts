import "server-only";

import { requestStructuredJson } from "@/lib/ai/client";
import { AIResponseParseError } from "@/lib/ai/errors";
import { buildDebugCoachMessages } from "@/lib/ai/debugPrompts";
import type { Difficulty } from "@/lib/types";

export type DebugCoachTestInput = {
  name: string;
  inputJson: unknown;
  expectedOutputJson: unknown;
  actualOutputJson?: unknown;
  passed: boolean;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  runtimeMs?: number;
};

export type DebugCoachInput = {
  problemTitle: string;
  difficulty: Difficulty;
  knownPatternName: string | null;
  recognitionClues: string[];
  commonMistakes: string[];
  userCode: string;
  tests: DebugCoachTestInput[];
  stdout: string;
  stderr: string;
  runtimeError: string | null;
  previousAttemptReflection: string | null;
};

export type DebugCoachSuggestedTestCase = {
  name: string;
  inputJson: unknown;
  expectedOutputJson: unknown;
};

export type DebugCoachSuggestedFlashcard = {
  front: string;
  back: string;
};

export type DebugCoachSuggestedMistake = {
  mistakeType: string;
  description: string;
  correction: string;
};

export type DebugCoachOutput = {
  summary: string;
  likelyCause: string;
  suggestedFix: string;
  followUpQuestion: string;
  suggestedTestCase?: DebugCoachSuggestedTestCase;
  suggestedFlashcard?: DebugCoachSuggestedFlashcard;
  suggestedMistake?: DebugCoachSuggestedMistake;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new AIResponseParseError(`Debug Coach field "${key}" must be text.`);
  }

  return value.trim();
}

function readOptionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];

  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readSuggestedTestCase(
  value: unknown,
): DebugCoachSuggestedTestCase | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AIResponseParseError("suggestedTestCase must be an object or null.");
  }

  return {
    name: readRequiredString(value, "name"),
    inputJson: value.inputJson ?? null,
    expectedOutputJson: value.expectedOutputJson ?? null,
  };
}

function readSuggestedFlashcard(
  value: unknown,
): DebugCoachSuggestedFlashcard | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AIResponseParseError("suggestedFlashcard must be an object or null.");
  }

  return {
    front: readRequiredString(value, "front"),
    back: readRequiredString(value, "back"),
  };
}

function readSuggestedMistake(
  value: unknown,
): DebugCoachSuggestedMistake | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new AIResponseParseError("suggestedMistake must be an object or null.");
  }

  return {
    mistakeType: readRequiredString(value, "mistakeType"),
    description: readRequiredString(value, "description"),
    correction: readRequiredString(value, "correction"),
  };
}

export function parseDebugCoachOutput(value: unknown): DebugCoachOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError("Debug Coach response must be a JSON object.");
  }

  return {
    summary: readRequiredString(value, "summary"),
    likelyCause: readRequiredString(value, "likelyCause"),
    suggestedFix: readRequiredString(value, "suggestedFix"),
    followUpQuestion:
      readOptionalString(value, "followUpQuestion") ??
      "What changed between the failing custom test and a case that works?",
    suggestedTestCase: readSuggestedTestCase(value.suggestedTestCase),
    suggestedFlashcard: readSuggestedFlashcard(value.suggestedFlashcard),
    suggestedMistake: readSuggestedMistake(value.suggestedMistake),
  };
}

export async function requestDebugCoach(
  input: DebugCoachInput,
): Promise<DebugCoachOutput> {
  const response = await requestStructuredJson({
    messages: buildDebugCoachMessages(input),
    temperature: 0.2,
    maxTokens: 1000,
  });

  return parseDebugCoachOutput(response);
}
