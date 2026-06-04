import "server-only";

import type {
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import { requestStructuredJson } from "@/lib/ai/client";
import { AIResponseParseError } from "@/lib/ai/errors";
import { buildAIPromptContext } from "@/lib/ai/safety";
import type {
  AIInterviewMessageInput,
  SuggestedFlashcard,
  SuggestedMistake,
} from "@/lib/ai/types";
import {
  calculateOverallRubricScore,
  clampInterviewScore,
} from "@/lib/interviews/scoring";
import type { Difficulty } from "@/lib/types";

type CategoryScores = Record<RubricCategory, number>;

export type ScoreInterviewRoundInput = {
  roundNumber: number;
  problemTitle: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  recognitionClues: string[];
  commonMistakes: string[];
  selectedPatternName: string | null;
  correctPatternName: string;
  secondaryPatternNames: string[];
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
  codeExecution: ScoreInterviewCodeExecution | null;
};

export type ScoreInterviewCodeExecution = {
  didRun: boolean;
  latestRunStatus: string | null;
  runtimeMs: number | null;
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  successfulRunCount: number;
  failedRunCount: number;
  userCreatedTestCount: number;
  fixedAfterFailedRun: boolean;
  stdout: string;
  stderr: string;
  runtimeError: string | null;
  failedTestSummaries: {
    name: string;
    inputJson: unknown;
    expectedOutputJson: unknown;
    actualOutputJson: unknown;
    errorMessage: string | null;
  }[];
};

export type ScoreInterviewInput = {
  interviewType: InterviewType;
  durationMinutes: number;
  startedAt: Date;
  completedAt: Date;
  rounds: ScoreInterviewRoundInput[];
  messages: AIInterviewMessageInput[];
};

export type ScoreInterviewOutput = CategoryScores & {
  overallScore: number;
  result: InterviewResult;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  missedSignals: string[];
  followUpRecommendations: string[];
  suggestedMistakes: SuggestedMistake[];
  suggestedFlashcards: SuggestedFlashcard[];
};

const RUBRIC_CATEGORIES: RubricCategory[] = [
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
    throw new AIResponseParseError(`AI scoring field "${key}" must be text.`);
  }

  return value.trim();
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new AIResponseParseError(
      `AI scoring field "${key}" must be a list of strings.`,
    );
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function readScore(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AIResponseParseError(`AI scoring field "${key}" must be a number.`);
  }

  return Math.max(1, clampInterviewScore(value));
}

function readResult(record: Record<string, unknown>): InterviewResult {
  const value = record.result;

  if (
    value !== "StrongHire" &&
    value !== "Hire" &&
    value !== "LeanHire" &&
    value !== "LeanNoHire" &&
    value !== "NoHire"
  ) {
    throw new AIResponseParseError(
      'AI scoring field "result" must be a valid interview result.',
    );
  }

  return value;
}

function readSuggestedMistakes(record: Record<string, unknown>): SuggestedMistake[] {
  const value = record.suggestedMistakes;

  if (!Array.isArray(value)) {
    throw new AIResponseParseError(
      'AI scoring field "suggestedMistakes" must be a list.',
    );
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError("Each suggested mistake must be an object.");
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
      'AI scoring field "suggestedFlashcards" must be a list.',
    );
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError("Each suggested flashcard must be an object.");
    }

    return {
      front: readString(item, "front"),
      back: readString(item, "back"),
    };
  });
}

function getResultFromScore(overallScore: number): InterviewResult {
  if (overallScore >= 85) {
    return "StrongHire";
  }

  if (overallScore >= 75) {
    return "Hire";
  }

  if (overallScore >= 65) {
    return "LeanHire";
  }

  if (overallScore >= 50) {
    return "LeanNoHire";
  }

  return "NoHire";
}

function parseAIScoreInterviewOutput(value: unknown): ScoreInterviewOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError("AI scoring response must be a JSON object.");
  }

  const categoryScores = RUBRIC_CATEGORIES.reduce((scores, category) => {
    scores[category] = readScore(value, category);

    return scores;
  }, {} as CategoryScores);
  const calculatedOverall = Math.max(
    1,
    calculateOverallRubricScore(categoryScores),
  );
  const requestedOverall = readScore(value, "overallScore");
  const overallScore = Math.round((calculatedOverall + requestedOverall) / 2);
  const parsedResult = readResult(value);

  return {
    ...categoryScores,
    overallScore,
    result:
      parsedResult === getResultFromScore(overallScore)
        ? parsedResult
        : getResultFromScore(overallScore),
    summary: readString(value, "summary"),
    strengths: readStringArray(value, "strengths"),
    weaknesses: readStringArray(value, "weaknesses"),
    missedSignals: readStringArray(value, "missedSignals"),
    followUpRecommendations: readStringArray(value, "followUpRecommendations"),
    suggestedMistakes: readSuggestedMistakes(value),
    suggestedFlashcards: readSuggestedFlashcards(value),
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function textLength(...values: Array<string | null>): number {
  return values.reduce((total, value) => total + (value?.trim().length ?? 0), 0);
}

function scoreText(value: string | null, medium: number, strong: number): number {
  const length = value?.trim().length ?? 0;

  if (length >= strong) {
    return 88;
  }

  if (length >= medium) {
    return 72;
  }

  if (length > 0) {
    return 45;
  }

  return 20;
}

function mentionsFailedCaseExplanation(value: string | null): boolean {
  const text = value?.toLowerCase() ?? "";

  return (
    text.includes("fail") ||
    text.includes("error") ||
    text.includes("expected") ||
    text.includes("actual") ||
    text.includes("fix")
  );
}

function scoreImplementationEvidence(round: ScoreInterviewRoundInput): number {
  const writtenScore = hasText(round.codeText)
    ? scoreText(round.codeText, 180, 600)
    : scoreText(round.approachText, 180, 520);
  const execution = round.codeExecution;

  if (!execution?.didRun) {
    return writtenScore;
  }

  let executionScore = writtenScore;

  if (
    execution.latestRunStatus === "Succeeded" &&
    execution.testsPassed > 0 &&
    execution.testsFailed === 0
  ) {
    executionScore = Math.max(executionScore, 82);
  } else if (
    execution.latestRunStatus === "RuntimeError" ||
    execution.latestRunStatus === "TimedOut"
  ) {
    executionScore = Math.min(executionScore, 58);
  } else if (execution.testsFailed > 0 || execution.failedRunCount > 0) {
    executionScore = Math.min(executionScore, 68);
  }

  if (execution.fixedAfterFailedRun) {
    executionScore += 8;
  }

  return clampInterviewScore(executionScore);
}

function scoreTestingEvidence(round: ScoreInterviewRoundInput): number {
  const writtenScore = scoreText(round.testCasesText, 80, 260);
  const execution = round.codeExecution;

  if (!execution?.didRun) {
    return writtenScore;
  }

  let testingScore = writtenScore;

  if (execution.totalTests >= 2 || execution.userCreatedTestCount >= 2) {
    testingScore = Math.max(testingScore, 78);
  } else if (execution.totalTests === 1) {
    testingScore = Math.max(testingScore, 62);
  }

  if (execution.testsFailed > 0) {
    testingScore = mentionsFailedCaseExplanation(round.testCasesText)
      ? Math.max(testingScore, 74)
      : Math.min(testingScore, 62);
  }

  if (
    execution.latestRunStatus === "Succeeded" &&
    execution.testsPassed > 0 &&
    execution.testsFailed === 0
  ) {
    testingScore = Math.max(testingScore, 82);
  }

  return clampInterviewScore(testingScore);
}

function average(scores: number[]): number {
  if (scores.length === 0) {
    return 1;
  }

  return Math.max(
    1,
    clampInterviewScore(
      scores.reduce((total, score) => total + score, 0) / scores.length,
    ),
  );
}

function getElapsedMinutes(input: ScoreInterviewInput): number {
  return Math.max(
    1,
    (input.completedAt.getTime() - input.startedAt.getTime()) / (1000 * 60),
  );
}

function buildFallbackScore(input: ScoreInterviewInput): ScoreInterviewOutput {
  const scores: CategoryScores = {
    Communication: average(
      input.rounds.map((round) =>
        scoreText(
          [
            round.patternExplanation,
            round.approachText,
            round.complexityText,
          ]
            .filter(Boolean)
            .join("\n"),
          120,
          360,
        ),
      ),
    ),
    PatternRecognition: average(
      input.rounds.map((round) => {
        if (!round.selectedPatternName) {
          return 20;
        }

        if (round.selectedPatternName === round.correctPatternName) {
          return scoreText(round.patternExplanation, 60, 180);
        }

        return hasText(round.patternExplanation) ? 40 : 25;
      }),
    ),
    ProblemSolving: average(
      input.rounds.map((round) => scoreText(round.approachText, 120, 380)),
    ),
    Implementation: average(
      input.rounds.map((round) => scoreImplementationEvidence(round)),
    ),
    Testing: average(
      input.rounds.map((round) => scoreTestingEvidence(round)),
    ),
    Complexity: average(
      input.rounds.map((round) =>
        round.complexityText?.toLowerCase().includes("o(")
          ? scoreText(round.complexityText, 40, 140)
          : hasText(round.complexityText)
            ? 50
            : 20,
      ),
    ),
    TimeManagement: clampInterviewScore(
      getElapsedMinutes(input) <= input.durationMinutes
        ? 88
        : 88 - (getElapsedMinutes(input) - input.durationMinutes) * 4,
    ),
  };
  const overallScore = Math.max(1, calculateOverallRubricScore(scores));
  const missedSignals = input.rounds.flatMap((round) => [
    round.selectedPatternName !== round.correctPatternName
      ? `Selected ${round.selectedPatternName ?? "no pattern"} instead of ${round.correctPatternName}.`
      : "",
    hasText(round.testCasesText) ? "" : "Testing phase did not include saved edge cases.",
    hasText(round.complexityText)
      ? ""
      : "Complexity phase did not include time and space analysis.",
    hasText(round.codeText)
      ? ""
      : "Implementation code was missing; implementation confidence is limited to the written plan.",
    round.codeExecution?.didRun
      ? ""
      : `Round ${round.roundNumber} did not include a PatternForge code run; implementation confidence is limited.`,
    round.codeExecution?.latestRunStatus === "RuntimeError" ||
    round.codeExecution?.latestRunStatus === "TimedOut"
      ? `Round ${round.roundNumber} had ${round.codeExecution.latestRunStatus} in custom execution.`
      : "",
    round.codeExecution?.testsFailed
      ? `Round ${round.roundNumber} had ${round.codeExecution.testsFailed} failed custom test${round.codeExecution.testsFailed === 1 ? "" : "s"}.`
      : "",
    round.codeExecution?.testsFailed &&
    !mentionsFailedCaseExplanation(round.testCasesText)
      ? `Round ${round.roundNumber} did not clearly explain failed custom cases in the Testing phase.`
      : "",
  ]).filter(Boolean);

  return {
    ...scores,
    overallScore,
    result: getResultFromScore(overallScore),
    summary:
      input.rounds.some((round) => round.codeExecution?.didRun)
        ? "Interview scored from saved PatternForge metadata, user-provided responses, and PatternForge custom self-test evidence. These runs are not official correctness results."
        : "Interview scored from saved PatternForge metadata and user-provided responses. Code was not run in PatternForge, so implementation confidence is limited.",
    strengths: [
      textLength(...input.rounds.map((round) => round.approachText)) > 200
        ? "Approach reasoning was captured with useful detail."
        : "",
      input.rounds.some(
        (round) => round.selectedPatternName === round.correctPatternName,
      )
        ? "At least one round identified the correct pattern."
        : "",
      textLength(...input.rounds.map((round) => round.testCasesText)) > 120
        ? "Testing discussion included meaningful cases."
        : "",
    ].filter(Boolean),
    weaknesses: [
      scores.PatternRecognition < 65
        ? "Pattern recognition needs review against the correct pattern."
        : "",
      scores.Implementation < 65
        ? "Implementation evidence was thin or incomplete."
        : "",
      scores.Complexity < 65
        ? "Complexity reasoning should be stated more explicitly."
        : "",
    ].filter(Boolean),
    missedSignals,
    followUpRecommendations: [
      "Redo the mock and verbalize the invariant before coding.",
      "Write edge cases before implementation in the next session.",
      ...input.rounds.map(
        (round) => `Review ${round.correctPatternName} recognition clues.`,
      ),
    ],
    suggestedMistakes: missedSignals.slice(0, 3).map((signal) => ({
      mistakeType: "Interview scoring signal",
      description: signal,
      correction: "Review the correct pattern, restate the invariant, and repeat the phase deliberately.",
    })),
    suggestedFlashcards: input.rounds.slice(0, 3).map((round) => ({
      front: `When should I consider ${round.correctPatternName}?`,
      back:
        round.recognitionClues[0] ??
        `Look for the invariant and input shape that fit ${round.correctPatternName}.`,
    })),
  };
}

function buildScoreInterviewMessages(input: ScoreInterviewInput) {
  return [
    {
      role: "system" as const,
      content: [
        "You are the PatternForge AI Interview Scorer.",
        "Score like a realistic but fair technical interviewer.",
        "Use only PatternForge metadata and user-provided text or code.",
        "Never copy, reconstruct, or invent LeetCode problem statements.",
        "Do not claim submitted code passes all tests, official tests, or LeetCode tests.",
        "Only describe execution as PatternForge custom tests or self-tests.",
        "If code is missing, score implementation from the plan and say confidence is limited.",
        "If codeExecution is null or didRun is false, say implementation confidence is limited because code was not run in PatternForge.",
        "If the selected pattern is wrong, explain the difference between selected and correct pattern without being harsh.",
        "Keep tone honest, specific, and constructive.",
        "Return valid JSON only. Do not wrap JSON in markdown.",
      ].join(" "),
    },
    {
      role: "user" as const,
      content: [
        "Evaluate the completed PatternForge mock interview.",
        "Score every category from 1 to 100:",
        "Communication: clarity, structure, and responses to interviewer prompts.",
        "PatternRecognition: correct pattern choice and explanation of why it applies.",
        "ProblemSolving: reasonable approach, key invariant, and data structure reasoning.",
        "Implementation: likely correctness from code, plan, and PatternForge custom execution evidence. Consider whether code ran, whether custom tests passed, whether runtime errors occurred, and whether the user fixed issues after a failed run.",
        "Testing: meaningful tests and edge cases. Consider whether the user wrote custom tests, whether they ran them, whether failed cases were explained, and whether the test set is substantial.",
        "Complexity: correctness of time and space analysis.",
        "TimeManagement: reasonable movement through phases based on timestamps and duration.",
        "Return JSON matching this TypeScript shape:",
        `{
  "overallScore": number,
  "Communication": number,
  "PatternRecognition": number,
  "ProblemSolving": number,
  "Implementation": number,
  "Testing": number,
  "Complexity": number,
  "TimeManagement": number,
  "result": "StrongHire" | "Hire" | "LeanHire" | "LeanNoHire" | "NoHire",
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "missedSignals": string[],
  "followUpRecommendations": string[],
  "suggestedMistakes": [
    { "mistakeType": string, "description": string, "correction": string }
  ],
  "suggestedFlashcards": [
    { "front": string, "back": string }
  ]
        }`,
        "PatternForge interview scoring input:",
        buildAIPromptContext(input, { label: "Interview scoring context" }),
      ].join("\n\n"),
    },
  ];
}

export async function scoreInterview(
  input: ScoreInterviewInput,
): Promise<ScoreInterviewOutput> {
  try {
    const response = await requestStructuredJson({
      messages: buildScoreInterviewMessages(input),
      temperature: 0.2,
      maxTokens: 1800,
    });

    return parseAIScoreInterviewOutput(response);
  } catch {
    return buildFallbackScore(input);
  }
}
