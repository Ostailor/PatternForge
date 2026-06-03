import "server-only";

import type { InterviewPhase, RubricCategory } from "@/generated/prisma/enums";
import { requestStructuredJson } from "@/lib/ai/client";
import { AIResponseParseError } from "@/lib/ai/errors";
import {
  buildInterviewFeedbackMessages,
  buildInterviewerMessages,
} from "@/lib/ai/interviewPrompts";
import type {
  AIInterviewFeedbackInput,
  AIInterviewFeedbackOutput,
  AIInterviewerInput,
  AIInterviewerOutput,
} from "@/lib/ai/types";
import { clampInterviewScore } from "@/lib/interviews/scoring";

const phases: InterviewPhase[] = [
  "Setup",
  "ClarifyingQuestions",
  "PatternHypothesis",
  "Approach",
  "Implementation",
  "Testing",
  "Complexity",
  "Feedback",
];

const rubricCategories: RubricCategory[] = [
  "Communication",
  "PatternRecognition",
  "ProblemSolving",
  "Implementation",
  "Testing",
  "Complexity",
  "TimeManagement",
];

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

function readOptionalPhase(
  record: Record<string, unknown>,
  key: string,
): InterviewPhase | null {
  const value = record[key];

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string" || !phases.includes(value as InterviewPhase)) {
    throw new AIResponseParseError(
      `AI response field "${key}" must be a valid interview phase or null.`,
    );
  }

  return value as InterviewPhase;
}

function readOptionalHintLevel(record: Record<string, unknown>): 1 | 2 | 3 | 4 | 5 | null {
  const value = record.hintLevel;

  if (value === null || value === undefined) {
    return null;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5
  ) {
    throw new AIResponseParseError(
      'AI response field "hintLevel" must be an integer from 1 to 5 or null.',
    );
  }

  return value as 1 | 2 | 3 | 4 | 5;
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

function readRubric(
  record: Record<string, unknown>,
): Partial<Record<RubricCategory, number>> {
  const value = record.rubric;

  if (!isRecord(value)) {
    throw new AIResponseParseError('AI response field "rubric" must be an object.');
  }

  return rubricCategories.reduce<Partial<Record<RubricCategory, number>>>(
    (rubric, category) => {
      const score = value[category];

      if (score === undefined || score === null) {
        return rubric;
      }

      if (typeof score !== "number" || !Number.isFinite(score)) {
        throw new AIResponseParseError(
          `AI rubric score "${category}" must be a number.`,
        );
      }

      rubric[category] = clampInterviewScore(score);

      return rubric;
    },
    {},
  );
}

export function parseAIInterviewerOutput(value: unknown): AIInterviewerOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError(
      "AI interviewer response must be a JSON object.",
    );
  }

  return {
    interviewerMessage: readString(value, "interviewerMessage"),
    phaseSuggestion: readOptionalPhase(value, "phaseSuggestion"),
    hintLevel: readOptionalHintLevel(value),
    concernFlags: readStringArray(value, "concernFlags"),
  };
}

export function parseAIInterviewFeedbackOutput(
  value: unknown,
): AIInterviewFeedbackOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError(
      "AI interview feedback response must be a JSON object.",
    );
  }

  return {
    summary: readString(value, "summary"),
    strengths: readStringArray(value, "strengths"),
    weaknesses: readStringArray(value, "weaknesses"),
    rubric: readRubric(value),
    followUpRecommendations: readStringArray(value, "followUpRecommendations"),
  };
}

function userAskedForHint(userInput: string): boolean {
  const normalized = userInput.toLowerCase();

  return (
    normalized.includes("hint") ||
    normalized.includes("stuck") ||
    normalized.includes("help me")
  );
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function isVagueOrIncompleteTranscript(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    wordCount(text) < 12 ||
    normalized.includes("something") ||
    normalized.includes("stuff") ||
    normalized.includes("basically just") ||
    normalized.includes("you know") ||
    normalized.includes("[inaudible]") ||
    normalized.includes("inaudible")
  );
}

function isRamblyTranscript(text: string): boolean {
  return wordCount(text) > 180;
}

function jumpsToCodeBeforePlan(input: AIInterviewerInput): boolean {
  if (input.currentPhase !== "Approach") {
    return false;
  }

  const normalized = input.userInput.toLowerCase();

  return (
    !input.currentPhaseData.approachText &&
    (normalized.includes("for ") ||
      normalized.includes("while ") ||
      normalized.includes("return ") ||
      normalized.includes("def ") ||
      normalized.includes("class ") ||
      normalized.includes("code"))
  );
}

function statesPatternWithoutJustification(input: AIInterviewerInput): boolean {
  if (input.currentPhase !== "PatternHypothesis") {
    return false;
  }

  const explanation = input.userInput.toLowerCase();

  return (
    wordCount(explanation) < 35 ||
    (!explanation.includes("because") &&
      !explanation.includes("constraint") &&
      !explanation.includes("signal") &&
      !explanation.includes("invariant") &&
      !explanation.includes("why"))
  );
}

export function buildFallbackInterviewerResponse(
  input: AIInterviewerInput,
): AIInterviewerOutput {
  const hintRequested = userAskedForHint(input.userInput);
  const canRevealPattern = input.canRevealCorrectPattern;

  if (input.userInputWasSpoken && isVagueOrIncompleteTranscript(input.userInput)) {
    return {
      interviewerMessage:
        "I am going to treat the transcript as incomplete rather than infer what you meant. Can you restate the key reasoning more concretely: what assumption, signal, or next step are you relying on?",
      phaseSuggestion: null,
      hintLevel: null,
      concernFlags: ["unclear_voice_transcript"],
    };
  }

  if (input.userInputWasSpoken && isRamblyTranscript(input.userInput)) {
    return {
      interviewerMessage:
        "That answer has a lot of detail. Summarize your approach in 2-3 sentences, then call out the invariant or edge case you think matters most.",
      phaseSuggestion: null,
      hintLevel: null,
      concernFlags: ["rambling_voice_answer"],
    };
  }

  if (input.userInputWasSpoken && jumpsToCodeBeforePlan(input)) {
    return {
      interviewerMessage:
        "Before we go into code, give me the high-level plan first: what state are you maintaining, what invariant should stay true, and what operation advances the solution?",
      phaseSuggestion: null,
      hintLevel: null,
      concernFlags: ["jumped_to_code_before_plan"],
    };
  }

  if (input.userInputWasSpoken && statesPatternWithoutJustification(input)) {
    return {
      interviewerMessage:
        "You stated a pattern, but I need the justification. What signal in the constraints or data shape makes that pattern fit, and what alternative are you ruling out?",
      phaseSuggestion: null,
      hintLevel: hintRequested ? 1 : null,
      concernFlags: ["pattern_without_justification"],
    };
  }

  switch (input.currentPhase) {
    case "Setup":
      return {
        interviewerMessage:
          "Open the external problem link and keep the statement in that tab. I will ask about reasoning and tradeoffs without revealing the pattern.",
        phaseSuggestion: "ClarifyingQuestions",
        hintLevel: null,
        concernFlags: [],
      };
    case "ClarifyingQuestions":
      return {
        interviewerMessage:
          "Good. Before moving on, state any input-size, ordering, duplicate, or empty-input assumptions you would confirm with an interviewer.",
        phaseSuggestion: input.userInput.trim() ? "PatternHypothesis" : null,
        hintLevel: null,
        concernFlags: input.userInput.includes("?") ? [] : ["missing_constraints"],
      };
    case "PatternHypothesis":
      return {
        interviewerMessage:
          "Your hypothesis is saved. Explain the signal that points to this pattern and one alternative pattern you are ruling out.",
        phaseSuggestion: input.userInput.trim() ? "Approach" : null,
        hintLevel: hintRequested ? 1 : null,
        concernFlags: canRevealPattern ? [] : ["pattern_revealed_risk"],
      };
    case "Approach":
      return {
        interviewerMessage:
          "Now make the invariant explicit. What state do you maintain, when does it change, and what tradeoff are you making versus a simpler brute-force approach?",
        phaseSuggestion: input.userInput.trim().length >= 80 ? "Implementation" : null,
        hintLevel: hintRequested ? 2 : null,
        concernFlags: input.userInput.trim().length >= 80 ? [] : ["thin_approach"],
      };
    case "Implementation":
      return {
        interviewerMessage:
          "Implementation captured. I have not run this code. Walk through how it handles the main update step and any boundary condition before moving to tests.",
        phaseSuggestion: input.userInput.trim().length >= 80 ? "Testing" : null,
        hintLevel: hintRequested ? 3 : null,
        concernFlags: ["code_not_run"],
      };
    case "Testing":
      return {
        interviewerMessage:
          "List a normal case, a smallest-input case, and one case that targets a common pitfall. Only say a test passed if you actually ran it elsewhere.",
        phaseSuggestion: input.userInput.trim().length >= 50 ? "Complexity" : null,
        hintLevel: hintRequested ? 4 : null,
        concernFlags: input.userInput.toLowerCase().includes("pass")
          ? ["unexecuted_tests_claim"]
          : ["weak_edge_cases"],
      };
    case "Complexity":
      return {
        interviewerMessage:
          "State time and space complexity, then tie each term to the loop, recursion, data structure, or maintained state in your approach.",
        phaseSuggestion: input.userInput.trim() ? "Feedback" : null,
        hintLevel: hintRequested ? 5 : null,
        concernFlags: input.userInput.toLowerCase().includes("o(")
          ? []
          : ["incomplete_complexity"],
      };
    case "Feedback":
      return {
        interviewerMessage:
          "Feedback is saved. Review the rubric and use the follow-up recommendations for your next mock session.",
        phaseSuggestion: null,
        hintLevel: null,
        concernFlags: [],
      };
  }
}

export function buildFallbackInterviewFeedback(
  input: AIInterviewFeedbackInput,
): AIInterviewFeedbackOutput {
  return {
    summary:
      "Interview feedback was generated from saved PatternForge artifacts. Code was not executed, so implementation scoring reflects review confidence only.",
    strengths: [
      input.patternExplanation ? "Pattern reasoning was captured." : "",
      input.approachText ? "Approach planning was captured before coding." : "",
      input.testCasesText ? "Testing discussion included saved cases." : "",
    ].filter(Boolean),
    weaknesses: [
      input.selectedPatternName === input.correctPattern
        ? ""
        : "Pattern selection should be reviewed against the correct pattern.",
      input.complexityText ? "" : "Complexity reasoning was missing.",
      input.codeText ? "" : "Implementation evidence was limited.",
    ].filter(Boolean),
    rubric: {},
    followUpRecommendations: [
      `Review ${input.correctPattern} using PatternForge pattern metadata.`,
      "Run a follow-up mock and state edge cases before implementation.",
      "Execute tests externally before claiming pass/fail status.",
    ],
  };
}

export async function requestAIInterviewerResponse(
  input: AIInterviewerInput,
): Promise<AIInterviewerOutput> {
  try {
    const response = await requestStructuredJson({
      messages: buildInterviewerMessages(input),
      temperature: 0.35,
      maxTokens: 700,
    });

    return parseAIInterviewerOutput(response);
  } catch {
    return buildFallbackInterviewerResponse(input);
  }
}

export async function requestAIInterviewFeedback(
  input: AIInterviewFeedbackInput,
): Promise<AIInterviewFeedbackOutput> {
  try {
    const response = await requestStructuredJson({
      messages: buildInterviewFeedbackMessages(input),
      temperature: 0.2,
      maxTokens: 1100,
    });

    return parseAIInterviewFeedbackOutput(response);
  } catch {
    return buildFallbackInterviewFeedback(input);
  }
}
