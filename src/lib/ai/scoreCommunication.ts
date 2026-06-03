import "server-only";

import type {
  CommunicationInsightType,
  InsightSeverity,
  InterviewPhase,
  InterviewType,
  VoiceSpeaker,
} from "@/generated/prisma/enums";
import { requestStructuredJson } from "@/lib/ai/client";
import { buildCommunicationScoringMessages } from "@/lib/ai/communicationPrompts";
import { AIResponseParseError } from "@/lib/ai/errors";
import type { AIInterviewMessageInput } from "@/lib/ai/types";
import type { ScoreInterviewCodeExecution } from "@/lib/ai/scoreInterview";
import { clampInterviewScore } from "@/lib/interviews/scoring";
import type { Difficulty } from "@/lib/types";

export type ScoreCommunicationVoiceTurnInput = {
  phase: InterviewPhase;
  speaker: VoiceSpeaker;
  transcript: string;
  durationMs: number | null;
  createdAt: string | null;
};

export type ScoreCommunicationRoundInput = {
  roundNumber: number;
  problemTitle: string;
  difficulty: Difficulty;
  phases: InterviewPhase[];
  patternExplanation: string | null;
  approachText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
  codeExecution: ScoreInterviewCodeExecution | null;
};

export type ScoreCommunicationFinalFeedbackInput = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  followUpRecommendations: string[];
} | null;

export type ScoreCommunicationInput = {
  interviewSessionId: string;
  interviewTitle: string;
  interviewType: InterviewType;
  durationMinutes: number;
  startedAt: string;
  completedAt: string;
  rounds: ScoreCommunicationRoundInput[];
  voiceTurns: ScoreCommunicationVoiceTurnInput[];
  messages: AIInterviewMessageInput[];
  finalFeedback: ScoreCommunicationFinalFeedbackInput;
};

export type CommunicationInsightOutput = {
  insightType: CommunicationInsightType;
  severity: InsightSeverity;
  summary: string;
  evidence: Record<string, unknown>;
};

export type ScoreCommunicationOutput = {
  clarityScore: number;
  structureScore: number;
  concisenessScore: number;
  confidenceScore: number;
  technicalExplanationScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestedPractice: string[];
  communicationInsights: CommunicationInsightOutput[];
};

const COMMUNICATION_INSIGHT_TYPES: CommunicationInsightType[] = [
  "UnclearApproach",
  "MissingInvariant",
  "TooVerbose",
  "TooQuietOrUncertain",
  "StrongExplanation",
  "WeakTestingExplanation",
  "WeakComplexityExplanation",
  "GoodTradeoffDiscussion",
];

const INSIGHT_SEVERITIES: InsightSeverity[] = ["Low", "Medium", "High"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || !value.trim()) {
    throw new AIResponseParseError(
      `AI communication scoring field "${key}" must be text.`,
    );
  }

  return value.trim();
}

function readStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new AIResponseParseError(
      `AI communication scoring field "${key}" must be a list of strings.`,
    );
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function readScore(record: Record<string, unknown>, key: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AIResponseParseError(
      `AI communication scoring field "${key}" must be a number.`,
    );
  }

  return Math.max(1, clampInterviewScore(value));
}

function readInsightType(record: Record<string, unknown>): CommunicationInsightType {
  const value = record.insightType;

  if (
    typeof value !== "string" ||
    !COMMUNICATION_INSIGHT_TYPES.includes(value as CommunicationInsightType)
  ) {
    throw new AIResponseParseError(
      'AI communication scoring field "insightType" must be a valid communication insight type.',
    );
  }

  return value as CommunicationInsightType;
}

function readSeverity(record: Record<string, unknown>): InsightSeverity {
  const value = record.severity;

  if (
    typeof value !== "string" ||
    !INSIGHT_SEVERITIES.includes(value as InsightSeverity)
  ) {
    throw new AIResponseParseError(
      'AI communication scoring field "severity" must be Low, Medium, or High.',
    );
  }

  return value as InsightSeverity;
}

function readEvidence(record: Record<string, unknown>): Record<string, unknown> {
  const value = record.evidence;

  return isRecord(value) ? value : {};
}

function readCommunicationInsights(
  record: Record<string, unknown>,
): CommunicationInsightOutput[] {
  const value = record.communicationInsights;

  if (!Array.isArray(value)) {
    throw new AIResponseParseError(
      'AI communication scoring field "communicationInsights" must be a list.',
    );
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new AIResponseParseError(
        "Each communication insight must be an object.",
      );
    }

    return {
      insightType: readInsightType(item),
      severity: readSeverity(item),
      summary: readString(item, "summary"),
      evidence: readEvidence(item),
    };
  });
}

function parseScoreCommunicationOutput(value: unknown): ScoreCommunicationOutput {
  if (!isRecord(value)) {
    throw new AIResponseParseError(
      "AI communication scoring response must be a JSON object.",
    );
  }

  return {
    clarityScore: readScore(value, "clarityScore"),
    structureScore: readScore(value, "structureScore"),
    concisenessScore: readScore(value, "concisenessScore"),
    confidenceScore: readScore(value, "confidenceScore"),
    technicalExplanationScore: readScore(value, "technicalExplanationScore"),
    summary: readString(value, "summary"),
    strengths: readStringArray(value, "strengths"),
    weaknesses: readStringArray(value, "weaknesses"),
    suggestedPractice: readStringArray(value, "suggestedPractice"),
    communicationInsights: readCommunicationInsights(value),
  };
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function textLength(...values: Array<string | null | undefined>): number {
  return values.reduce((total, value) => total + (value?.trim().length ?? 0), 0);
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function scoreTextPresence(value: string | null, medium: number, strong: number): number {
  const length = value?.trim().length ?? 0;

  if (length >= strong) {
    return 86;
  }

  if (length >= medium) {
    return 72;
  }

  if (length > 0) {
    return 55;
  }

  return 35;
}

function average(scores: number[]): number {
  if (scores.length === 0) {
    return 50;
  }

  return Math.max(
    1,
    clampInterviewScore(
      scores.reduce((total, score) => total + score, 0) / scores.length,
    ),
  );
}

function getUserTranscriptText(input: ScoreCommunicationInput): string {
  return input.voiceTurns
    .filter((turn) => turn.speaker === "User")
    .map((turn) => turn.transcript)
    .join("\n");
}

function hasHedgingLanguage(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    normalized.includes("i guess") ||
    normalized.includes("maybe") ||
    normalized.includes("not sure") ||
    normalized.includes("probably") ||
    normalized.includes("kind of") ||
    normalized.includes("sort of")
  );
}

function hasTradeoffLanguage(text: string): boolean {
  const normalized = text.toLowerCase();

  return (
    normalized.includes("tradeoff") ||
    normalized.includes("instead") ||
    normalized.includes("because") ||
    normalized.includes("versus") ||
    normalized.includes("compared")
  );
}

function buildFallbackCommunicationScore(
  input: ScoreCommunicationInput,
): ScoreCommunicationOutput {
  const transcriptText = getUserTranscriptText(input);
  const transcriptWords = countWords(transcriptText);
  const technicalTextLength = textLength(
    ...input.rounds.flatMap((round) => [
      round.patternExplanation,
      round.approachText,
      round.testCasesText,
      round.complexityText,
    ]),
  );
  const structureScore = average(
    input.rounds.map((round) =>
      hasText(round.approachText)
        ? scoreTextPresence(round.approachText, 120, 360)
        : 45,
    ),
  );
  const testingScore = average(
    input.rounds.map((round) => scoreTextPresence(round.testCasesText, 60, 180)),
  );
  const complexityScore = average(
    input.rounds.map((round) =>
      round.complexityText?.toLowerCase().includes("o(")
        ? scoreTextPresence(round.complexityText, 35, 120)
        : hasText(round.complexityText)
          ? 58
          : 35,
    ),
  );
  const clarityScore =
    transcriptWords === 0
      ? average(input.messages.map((message) => scoreTextPresence(message.content, 40, 140)))
      : transcriptWords < 35
        ? 62
        : transcriptWords > 450
          ? 68
          : 78;
  const concisenessScore =
    transcriptWords > 650 ? 45 : transcriptWords > 350 ? 62 : transcriptWords > 0 ? 78 : 65;
  const confidenceScore =
    transcriptWords === 0
      ? 60
      : hasHedgingLanguage(transcriptText)
        ? 58
        : 74;
  const technicalExplanationScore = average([
    scoreTextPresence(
      input.rounds.map((round) => round.patternExplanation).join("\n"),
      60,
      180,
    ),
    structureScore,
    testingScore,
    complexityScore,
  ]);
  const sparseTranscript = transcriptWords < 40;
  const communicationInsightCandidates: Array<CommunicationInsightOutput | null> = [
    structureScore < 65
      ? {
          insightType: "MissingInvariant",
          severity: "Medium",
          summary:
            "The approach did not consistently make the invariant or maintained state explicit.",
          evidence: { reason: "Approach text was sparse or missing." },
        }
      : null,
    concisenessScore < 65
      ? {
          insightType: "TooVerbose",
          severity: "Medium",
          summary:
            "The transcript appears lengthy enough that summarizing the approach would improve interview pacing.",
          evidence: { transcriptWords },
        }
      : null,
    testingScore < 65
      ? {
          insightType: "WeakTestingExplanation",
          severity: "Medium",
          summary:
            "Testing explanation should include normal cases, edge cases, and failed-case reasoning when applicable.",
          evidence: { reason: "Testing text was sparse or missing." },
        }
      : null,
    complexityScore < 65
      ? {
          insightType: "WeakComplexityExplanation",
          severity: "Medium",
          summary:
            "Complexity explanation should tie time and space terms to loops, data structures, or maintained state.",
          evidence: { reason: "Complexity text was sparse or missing Big-O notation." },
        }
      : null,
    technicalTextLength >= 450
      ? {
          insightType: "StrongExplanation",
          severity: "Low",
          summary:
            "The interview captured substantial technical explanation across phases.",
          evidence: { technicalTextLength },
        }
      : null,
    hasTradeoffLanguage(transcriptText)
      ? {
          insightType: "GoodTradeoffDiscussion",
          severity: "Low",
          summary:
            "The transcript includes tradeoff or justification language, which helps interviewers follow decisions.",
          evidence: { reason: "Tradeoff-oriented wording found in transcript." },
        }
      : null,
  ];
  const communicationInsights = communicationInsightCandidates.filter(
    (insight): insight is CommunicationInsightOutput => insight !== null,
  );

  return {
    clarityScore: Math.max(1, clampInterviewScore(clarityScore)),
    structureScore,
    concisenessScore: Math.max(1, clampInterviewScore(concisenessScore)),
    confidenceScore: Math.max(1, clampInterviewScore(confidenceScore)),
    technicalExplanationScore,
    summary: sparseTranscript
      ? "Communication score is based on limited transcript evidence plus saved interview text, so confidence in the communication score is limited."
      : "Communication score is based on saved voice transcripts, interview messages, and phase explanations.",
    strengths: [
      technicalTextLength >= 450
        ? "Technical reasoning was captured across multiple phases."
        : "",
      structureScore >= 70 ? "Approach structure was reasonably clear." : "",
      hasTradeoffLanguage(transcriptText)
        ? "The user included justification or tradeoff language."
        : "",
    ].filter(Boolean),
    weaknesses: [
      sparseTranscript ? "Voice transcript evidence was sparse." : "",
      structureScore < 65 ? "Invariant and state should be stated more explicitly." : "",
      testingScore < 65 ? "Testing explanation needs more concrete edge cases." : "",
      complexityScore < 65 ? "Complexity explanation needs clearer Big-O reasoning." : "",
    ].filter(Boolean),
    suggestedPractice: [
      "Practice answering each phase with: signal, invariant, plan, edge cases, complexity.",
      "Summarize the approach in 2-3 sentences before implementation details.",
      "Use one concrete edge case and one tradeoff in each spoken explanation.",
    ],
    communicationInsights:
      communicationInsights.length > 0
        ? communicationInsights
        : [
            {
              insightType: "StrongExplanation",
              severity: "Low",
              summary:
                "No major communication gaps were detected from the available saved evidence.",
              evidence: { transcriptWords, technicalTextLength },
            },
          ],
  };
}

export async function scoreCommunication(
  input: ScoreCommunicationInput,
): Promise<ScoreCommunicationOutput> {
  try {
    const response = await requestStructuredJson({
      messages: buildCommunicationScoringMessages(input),
      temperature: 0.2,
      maxTokens: 1400,
    });

    return parseScoreCommunicationOutput(response);
  } catch {
    return buildFallbackCommunicationScore(input);
  }
}
