"use server";

import { getPatternById } from "@/data/patterns";
import { getProblemById } from "@/data/problems";
import { generateHints } from "@/lib/ai/generateHints";
import { buildFallbackHints } from "@/lib/ai/hints";
import type { AIHintInput, AIHintOutput } from "@/lib/ai/types";

export type RequestHintsResult =
  | { status: "generated"; hints: AIHintOutput }
  | { status: "fallback"; hints: AIHintOutput; message: string }
  | { status: "invalid"; message: string };

function buildHintInput(problemId: string): AIHintInput | null {
  const problem = getProblemById(problemId);

  if (!problem) {
    return null;
  }

  const primaryPattern = getPatternById(problem.primaryPatternId);

  if (!primaryPattern) {
    return null;
  }

  const secondaryPatternNames = problem.secondaryPatternIds
    .map((patternId) => getPatternById(patternId)?.name)
    .filter((patternName) => patternName !== undefined);

  return {
    problemTitle: problem.title,
    difficulty: problem.difficulty,
    patternName: primaryPattern.name,
    secondaryPatternNames,
    recognitionClues: [
      ...problem.recognitionClues,
      ...primaryPattern.recognitionClues,
    ],
    commonMistakes: [
      ...problem.commonMistakes,
      ...primaryPattern.commonMistakes,
    ],
  };
}

export async function requestHintsAction(
  problemId: string,
): Promise<RequestHintsResult> {
  const input = buildHintInput(problemId);

  if (!input) {
    return { status: "invalid", message: "Problem hints are not available." };
  }

  try {
    return {
      status: "generated",
      hints: await generateHints(input),
    };
  } catch {
    return {
      status: "fallback",
      hints: buildFallbackHints(input),
      message: "AI hints are unavailable, so PatternForge loaded seeded hints.",
    };
  }
}
