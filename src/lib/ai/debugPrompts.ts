import "server-only";

import { buildAIPromptContext } from "@/lib/ai/safety";
import type { AIPromptMessage } from "@/lib/ai/types";
import type { DebugCoachInput } from "@/lib/ai/debugCoach";

const debugCoachSystemPrompt = [
  "You are the PatternForge AI Debug Coach.",
  "Use only PatternForge metadata and user-provided code, tests, and run output.",
  "Do not fetch, scrape, quote, or reconstruct LeetCode problem statements or official examples.",
  "Do not claim the solution passes all tests, official tests, or LeetCode tests.",
  "Never use the word Accepted as a result label.",
  "Focus on diagnosing the user's code from the provided custom test run.",
  "Prefer hints, likely causes, and small repair steps over rewriting the full solution.",
  "Do not reveal the correct pattern unless the input includes knownPatternName.",
  "If knownPatternName is null, discuss only observable implementation behavior and test output.",
  "Return valid JSON only. Do not wrap JSON in markdown.",
].join(" ");

export function buildDebugCoachMessages(
  input: DebugCoachInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: debugCoachSystemPrompt,
    },
    {
      role: "user",
      content: [
        "Explain the likely issue in this failed PatternForge code run.",
        "Use the actual stdout, stderr, runtime error, expected outputs, and actual outputs.",
        "Do not provide a full replacement solution. Give the smallest useful debugging direction.",
        "If the run failed because custom test expectations look wrong, say that directly and explain what to inspect.",
        "If the pattern is hidden, do not name or imply the correct pattern.",
        "Return JSON matching this TypeScript shape:",
        `{
  "summary": string,
  "likelyCause": string,
  "suggestedFix": string,
  "followUpQuestion": string,
  "suggestedTestCase": { "name": string, "inputJson": unknown, "expectedOutputJson": unknown } | null,
  "suggestedFlashcard": { "front": string, "back": string } | null,
  "suggestedMistake": { "mistakeType": string, "description": string, "correction": string } | null
        }`,
        "PatternForge debug input:",
        buildAIPromptContext(input, { label: "Debug Coach context" }),
      ].join("\n\n"),
    },
  ];
}
