"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Prisma } from "@/generated/prisma/client";
import { GameEventType } from "@/generated/prisma/enums";
import type { InterviewPhase, RubricCategory } from "@/generated/prisma/enums";
import { patterns } from "@/data/patterns";
import { requestAIInterviewerResponse } from "@/lib/ai/interviewer";
import { scoreCommunication } from "@/lib/ai/scoreCommunication";
import { scoreInterview } from "@/lib/ai/scoreInterview";
import type { ScoreInterviewCodeExecution } from "@/lib/ai/scoreInterview";
import type {
  AIInterviewCodeExecutionInput,
  AIInterviewMessageInput,
  AIInterviewVoiceTurnInput,
  AIInterviewerInput,
} from "@/lib/ai/types";
import { checkAchievementsWithClient } from "@/lib/achievements/service";
import { createGameEventWithClient } from "@/lib/game/events";
import { calculateInterviewRewards } from "@/lib/interviews/rewards";
import { getPrisma } from "@/lib/prisma";
import {
  createAttemptForUserProfileWithClient,
  type CreateAttemptInput,
} from "@/lib/progress-db";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import type { Confidence, SolvedStatus } from "@/lib/types";
import { transcribeInterviewTurn } from "@/lib/voice/transcription";
import {
  MAX_RECORDING_DURATION_MS,
  MAX_TRANSCRIPT_LENGTH,
  isTranscriptLengthAllowed,
} from "@/lib/voice/voiceLimits";

type RoundForScoring = {
  roundNumber: number;
  problemId: string;
  attemptId: string | null;
  aiReviewId?: string | null;
  selectedPatternId: string | null;
  correctPatternId: string;
  selectedPattern?: { name: string } | null;
  correctPattern?: { name: string } | null;
  problem?: {
    title: string;
    difficulty: "Easy" | "Medium" | "Hard";
    estimatedMinutes: number;
    recognitionClues: string[];
    commonMistakes: string[];
    problemPatterns?: {
      isPrimary: boolean;
      pattern: { name: string };
    }[];
  };
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
  voiceTurns?: {
    phase: InterviewPhase;
    speaker: "User" | "Interviewer" | "System";
    transcript: string;
    durationMs: number | null;
    createdAt: Date;
  }[];
  debugInsights?: {
    id: string;
  }[];
  codeSubmissions?: {
    id: string;
    codeRuns: {
      id: string;
      status: string;
      stdout: string;
      stderr: string;
      errorMessage: string | null;
      runtimeMs: number | null;
      createdAt: Date;
      testResults: {
        name: string;
        inputJson: unknown;
        expectedOutputJson: unknown;
        actualOutputJson: unknown;
        passed: boolean;
        errorMessage: string | null;
        testCase: {
          source: string;
        } | null;
      }[];
    }[];
  }[];
};

type InterviewForFinalization = {
  id: string;
  userProfileId: string;
  interviewType: AIInterviewerInput["interviewType"];
  title: string;
  startedAt: Date;
  durationMinutes: number;
  messages: {
    role: "User" | "Interviewer" | "System";
    phase: InterviewPhase;
    content: string;
  }[];
  voiceTurns: {
    phase: InterviewPhase;
    speaker: "User" | "Interviewer" | "System";
    transcript: string;
    durationMs: number | null;
    createdAt: Date;
  }[];
  rounds: RoundForScoring[];
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

const VOICE_REWARD_MAJOR_PHASES: InterviewPhase[] = [
  "ClarifyingQuestions",
  "PatternHypothesis",
  "Approach",
  "Testing",
  "Complexity",
];

const interviewRoundAIInclude = {
  selectedPattern: true,
  correctPattern: true,
  problem: {
    include: {
      problemPatterns: {
        include: {
          pattern: true,
        },
      },
    },
  },
  messages: true,
  voiceTurns: {
    orderBy: {
      createdAt: "asc" as const,
    },
  },
  debugInsights: {
    select: {
      id: true,
    },
  },
  codeSubmissions: {
    include: {
      codeRuns: {
        orderBy: {
          createdAt: "asc" as const,
        },
        include: {
          testResults: {
            orderBy: {
              createdAt: "asc" as const,
            },
            include: {
              testCase: {
                select: {
                  source: true,
                },
              },
            },
          },
        },
      },
    },
  },
};

export type InterviewVoiceTranscriptionResult =
  | {
      status: "success";
      transcript: string;
      confidence?: number;
      durationMs?: number;
    }
  | {
      status: "fallback";
      message: string;
    };

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);

  return value instanceof File && value.size > 0 ? value : null;
}

function readPhase(formData: FormData): InterviewPhase | null {
  const phase = readString(formData, "phase");

  if (
    phase === "Setup" ||
    phase === "ClarifyingQuestions" ||
    phase === "PatternHypothesis" ||
    phase === "Approach" ||
    phase === "Implementation" ||
    phase === "Testing" ||
    phase === "Complexity"
  ) {
    return phase;
  }

  return null;
}

function readSolvedStatus(formData: FormData): SolvedStatus {
  const value = readString(formData, "solvedStatus");

  if (
    value === "Solved" ||
    value === "Partially Solved" ||
    value === "Not Solved"
  ) {
    return value;
  }

  return "Partially Solved";
}

function readConfidence(formData: FormData): Confidence {
  const value = Number.parseInt(readString(formData, "confidence"), 10);

  if (value >= 1 && value <= 5) {
    return value as Confidence;
  }

  return 3;
}

function readPositiveInt(
  formData: FormData,
  key: string,
  fallback: number,
): number {
  const value = Number.parseInt(readString(formData, key), 10);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function clampCommunicationScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 1;
  }

  return Math.max(1, Math.min(100, Math.round(score)));
}

function requireText(value: string, message: string): string {
  if (!value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function readOptionalDate(formData: FormData, key: string): Date | undefined {
  const value = readString(formData, key);

  if (!value) {
    return undefined;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function readVoiceDurationMs(formData: FormData): number | undefined {
  const durationMs = readPositiveInt(formData, "voiceDurationMs", 0);

  if (durationMs <= 0) {
    return undefined;
  }

  return Math.min(durationMs, MAX_RECORDING_DURATION_MS);
}

function hasAcceptedVoiceTranscript(formData: FormData): boolean {
  return readString(formData, "voiceTranscriptAccepted") === "true";
}

async function getOrCreateActiveVoiceSession({
  tx,
  userProfileId,
  interviewSessionId,
}: {
  tx: Prisma.TransactionClient;
  userProfileId: string;
  interviewSessionId: string;
}) {
  const existingSession = await tx.voiceSession.findFirst({
    where: {
      userProfileId,
      interviewSessionId,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (existingSession) {
    return existingSession;
  }

  return tx.voiceSession.create({
    data: {
      userProfileId,
      interviewSessionId,
      status: "Active",
    },
  });
}

async function saveVoiceTurnIfAccepted({
  tx,
  formData,
  userProfileId,
  interviewSessionId,
  interviewRoundId,
  phase,
  transcript,
}: {
  tx: Prisma.TransactionClient;
  formData: FormData;
  userProfileId: string;
  interviewSessionId: string;
  interviewRoundId: string;
  phase: InterviewPhase;
  transcript: string;
}) {
  if (!hasAcceptedVoiceTranscript(formData)) {
    return;
  }

  const normalizedTranscript = transcript.trim();

  if (!normalizedTranscript || !isTranscriptLengthAllowed(normalizedTranscript)) {
    return;
  }

  const voiceSession = await getOrCreateActiveVoiceSession({
    tx,
    userProfileId,
    interviewSessionId,
  });

  await tx.voiceTurn.create({
    data: {
      voiceSessionId: voiceSession.id,
      interviewSessionId,
      interviewRoundId,
      phase,
      speaker: "User",
      transcript: normalizedTranscript,
      durationMs: readVoiceDurationMs(formData),
      startedAt: readOptionalDate(formData, "voiceStartedAt"),
      endedAt: readOptionalDate(formData, "voiceEndedAt"),
    },
  });
}

async function hasInterviewRoundCodeSubmission({
  tx,
  userProfileId,
  problemId,
  interviewRoundId,
}: {
  tx: Prisma.TransactionClient;
  userProfileId: string;
  problemId: string;
  interviewRoundId: string;
}): Promise<boolean> {
  const submission = await tx.codeSubmission.findFirst({
    where: {
      userProfileId,
      problemId,
      interviewRoundId,
    },
    select: {
      id: true,
    },
  });

  return Boolean(submission);
}

async function hasInterviewRoundCodeRun({
  tx,
  userProfileId,
  problemId,
  interviewRoundId,
}: {
  tx: Prisma.TransactionClient;
  userProfileId: string;
  problemId: string;
  interviewRoundId: string;
}): Promise<boolean> {
  const run = await tx.codeRun.findFirst({
    where: {
      userProfileId,
      codeSubmission: {
        userProfileId,
        problemId,
        interviewRoundId,
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(run);
}

export async function transcribeInterviewVoiceTurnAction(
  formData: FormData,
): Promise<InterviewVoiceTranscriptionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return {
      status: "fallback",
      message: "Sign in to use Voice Mode, or type your answer manually.",
    };
  }

  const interviewId = readString(formData, "interviewId");
  const roundId = readString(formData, "roundId");
  const phase = readPhase(formData);
  const audioFile = readFile(formData, "audio");

  if (!interviewId || !roundId || !phase || !audioFile) {
    return {
      status: "fallback",
      message: "Voice input could not be read. Type your answer manually.",
    };
  }

  const interview = await getPrisma().interviewSession.findFirst({
    where: {
      id: interviewId,
      userProfileId: userProfile.id,
      status: "Active",
      rounds: {
        some: {
          id: roundId,
          interviewSessionId: interviewId,
        },
      },
    },
    select: {
      id: true,
      rounds: {
        where: {
          id: roundId,
        },
        select: {
          id: true,
          status: true,
        },
      },
    },
  });

  const round = interview?.rounds[0];

  if (!interview || !round || round.status === "Completed" || round.status === "Skipped") {
    return {
      status: "fallback",
      message: "This interview phase is no longer available for voice input.",
    };
  }

  const result = await transcribeInterviewTurn({
    audioBlob: audioFile,
    durationMs: readVoiceDurationMs(formData),
    phase,
    interviewSessionId: interview.id,
    interviewRoundId: round.id,
  });

  if (result.status === "fallback") {
    return {
      status: "fallback",
      message: result.message,
    };
  }

  return {
    status: "success",
    transcript: result.output.transcript.slice(0, MAX_TRANSCRIPT_LENGTH),
    confidence: result.output.confidence,
    durationMs: result.output.durationMs,
  };
}

export async function abandonVoiceSessionAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");

  if (!interviewId) {
    redirect("/interviews");
  }

  await getPrisma().voiceSession.updateMany({
    where: {
      userProfileId: userProfile.id,
      interviewSessionId: interviewId,
      status: "Active",
      interviewSession: {
        userProfileId: userProfile.id,
      },
    },
    data: {
      status: "Abandoned",
      completedAt: new Date(),
    },
  });

  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/summary`);
  revalidatePath(`/interviews/${interviewId}/transcript`);
  redirect(`/interviews/${interviewId}?voice=abandoned`);
}

export async function deleteVoiceTranscriptsAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");

  if (!interviewId) {
    redirect("/interviews");
  }

  await getPrisma().$transaction(async (tx) => {
    const interview = await tx.interviewSession.findFirst({
      where: {
        id: interviewId,
        userProfileId: userProfile.id,
      },
      select: {
        id: true,
      },
    });

    if (!interview) {
      return;
    }

    await tx.communicationInsight.deleteMany({
      where: {
        userProfileId: userProfile.id,
        interviewSessionId: interview.id,
      },
    });
    await tx.voiceFeedback.deleteMany({
      where: {
        userProfileId: userProfile.id,
        interviewSessionId: interview.id,
      },
    });
    await tx.voiceTurn.deleteMany({
      where: {
        interviewSessionId: interview.id,
        interviewSession: {
          userProfileId: userProfile.id,
        },
      },
    });
    await tx.voiceSession.updateMany({
      where: {
        userProfileId: userProfile.id,
        interviewSessionId: interview.id,
      },
      data: {
        status: "Abandoned",
        completedAt: new Date(),
      },
    });
    await tx.interviewSession.update({
      where: {
        id: interview.id,
      },
      data: {
        communicationScore: null,
      },
    });
  });

  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/summary`);
  revalidatePath(`/interviews/${interviewId}/transcript`);
  revalidatePath("/readiness");
  redirect(`/interviews/${interviewId}/transcript?voiceAction=deleted`);
}

function getPatternName(patternId: string | null): string {
  return patterns.find((pattern) => pattern.id === patternId)?.name ?? "Unknown";
}

function toAIMessageInput(message: {
  role: "User" | "Interviewer" | "System";
  phase: InterviewPhase;
  content: string;
}): AIInterviewMessageInput {
  return {
    role: message.role,
    phase: message.phase,
    content: message.content,
  };
}

function uniqueMessages(
  messages: {
    role: "User" | "Interviewer" | "System";
    phase: InterviewPhase;
    content: string;
  }[],
): AIInterviewMessageInput[] {
  const seen = new Set<string>();

  return messages.flatMap((message) => {
    const key = `${message.role}:${message.phase}:${message.content}`;

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [toAIMessageInput(message)];
  });
}

function toAIVoiceTurnInput(voiceTurn: {
  phase: InterviewPhase;
  speaker: "User" | "Interviewer" | "System";
  transcript: string;
  durationMs?: number | null;
  createdAt?: Date | null;
}): AIInterviewVoiceTurnInput {
  return {
    phase: voiceTurn.phase,
    speaker: voiceTurn.speaker,
    transcript: voiceTurn.transcript,
    durationMs: voiceTurn.durationMs ?? null,
    createdAt: voiceTurn.createdAt?.toISOString() ?? null,
  };
}

function toAICodeExecutionInput(
  codeExecution: ReturnType<typeof buildRoundCodeExecution>,
): AIInterviewCodeExecutionInput | null {
  return codeExecution;
}

function getVoiceTurnsForAI({
  interview,
  round,
  phase,
  currentTranscript,
  currentTranscriptWasSpoken,
}: {
  interview: {
    voiceTurns?: {
      phase: InterviewPhase;
      speaker: "User" | "Interviewer" | "System";
      transcript: string;
      durationMs: number | null;
      createdAt: Date;
    }[];
  };
  round: RoundForScoring;
  phase: InterviewPhase;
  currentTranscript: string;
  currentTranscriptWasSpoken: boolean;
}): {
  previousVoiceTurns: AIInterviewVoiceTurnInput[];
  currentPhaseVoiceTurns: AIInterviewVoiceTurnInput[];
} {
  const savedVoiceTurns = [...(interview.voiceTurns ?? []), ...(round.voiceTurns ?? [])];
  const seen = new Set<string>();
  const uniqueVoiceTurns = savedVoiceTurns.flatMap((voiceTurn) => {
    const key = [
      voiceTurn.phase,
      voiceTurn.speaker,
      voiceTurn.createdAt.getTime(),
      voiceTurn.transcript,
    ].join(":");

    if (seen.has(key)) {
      return [];
    }

    seen.add(key);
    return [toAIVoiceTurnInput(voiceTurn)];
  });
  const currentVoiceTurn =
    currentTranscriptWasSpoken && currentTranscript.trim()
      ? [
          {
            phase,
            speaker: "User" as const,
            transcript: currentTranscript.trim(),
            durationMs: null,
            createdAt: new Date().toISOString(),
          },
        ]
      : [];

  return {
    previousVoiceTurns: uniqueVoiceTurns,
    currentPhaseVoiceTurns: [
      ...uniqueVoiceTurns.filter((voiceTurn) => voiceTurn.phase === phase),
      ...currentVoiceTurn,
    ],
  };
}

function getSecondaryPatternNames(round: RoundForScoring): string[] {
  return (
    round.problem?.problemPatterns
      ?.filter((problemPattern) => !problemPattern.isPrimary)
      .map((problemPattern) => problemPattern.pattern.name) ?? []
  );
}

function buildAttemptReflection({
  round,
  solvedStatus,
  confidence,
}: {
  round: RoundForScoring;
  solvedStatus: SolvedStatus;
  confidence: Confidence;
}): string {
  return [
    `Interview round ${round.roundNumber}`,
    `Self-reported status: ${solvedStatus}`,
    `Confidence: ${confidence}/5`,
    `Pattern hypothesis: ${
      round.selectedPattern?.name ??
      getPatternName(round.selectedPatternId) ??
      "Not selected"
    }`,
    `Pattern explanation:\n${round.patternExplanation ?? "Not recorded"}`,
    `Approach:\n${round.approachText ?? "Not recorded"}`,
    `Implementation:\n${round.codeText ?? "Not recorded"}`,
    `Testing:\n${round.testCasesText ?? "Not recorded"}`,
    `Complexity:\n${round.complexityText ?? "Not recorded"}`,
  ].join("\n\n");
}

function isUnsuccessfulRun(status: string): boolean {
  return status !== "Succeeded";
}

function buildRoundCodeExecution(
  round: RoundForScoring,
): ScoreInterviewCodeExecution | null {
  const runs = (round.codeSubmissions ?? [])
    .flatMap((submission) => submission.codeRuns)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const latestRun = runs.at(-1);

  if (!latestRun) {
    return null;
  }

  const failedTestResults = latestRun.testResults.filter(
    (testResult) => !testResult.passed,
  );
  const successfulRunCount = runs.filter((run) => run.status === "Succeeded").length;
  const failedRunCount = runs.filter((run) => isUnsuccessfulRun(run.status)).length;
  const firstFailedRunIndex = runs.findIndex((run) => isUnsuccessfulRun(run.status));
  const fixedAfterFailedRun =
    firstFailedRunIndex >= 0 &&
    runs
      .slice(firstFailedRunIndex + 1)
      .some((run) => run.status === "Succeeded");

  return {
    didRun: true,
    latestRunStatus: latestRun.status,
    runtimeMs: latestRun.runtimeMs,
    totalTests: latestRun.testResults.length,
    testsPassed: latestRun.testResults.length - failedTestResults.length,
    testsFailed: failedTestResults.length,
    successfulRunCount,
    failedRunCount,
    userCreatedTestCount: latestRun.testResults.filter(
      (testResult) => testResult.testCase?.source === "User",
    ).length,
    fixedAfterFailedRun,
    stdout: latestRun.stdout,
    stderr: latestRun.stderr,
    runtimeError: latestRun.errorMessage,
    failedTestSummaries: failedTestResults.slice(0, 5).map((testResult) => ({
      name: testResult.name,
      inputJson: testResult.inputJson,
      expectedOutputJson: testResult.expectedOutputJson,
      actualOutputJson: testResult.actualOutputJson,
      errorMessage: testResult.errorMessage,
    })),
  };
}

function buildAIInterviewerInput({
  interview,
  round,
  phase,
  userInput,
  userInputWasSpoken,
}: {
  interview: {
    interviewType: AIInterviewerInput["interviewType"];
    messages: { role: "User" | "Interviewer" | "System"; phase: InterviewPhase; content: string }[];
    voiceTurns?: {
      phase: InterviewPhase;
      speaker: "User" | "Interviewer" | "System";
      transcript: string;
      durationMs: number | null;
      createdAt: Date;
    }[];
  };
  round: RoundForScoring & {
    messages?: { role: "User" | "Interviewer" | "System"; phase: InterviewPhase; content: string }[];
  };
  phase: InterviewPhase;
  userInput: string;
  userInputWasSpoken?: boolean;
}): AIInterviewerInput {
  const spokenInput =
    userInputWasSpoken ??
    Boolean(round.voiceTurns?.some(
      (voiceTurn) =>
        voiceTurn.phase === phase &&
        voiceTurn.speaker === "User" &&
        voiceTurn.transcript.trim() === userInput.trim(),
    ));
  const voiceTurns = getVoiceTurnsForAI({
    interview,
    round,
    phase,
    currentTranscript: userInput,
    currentTranscriptWasSpoken: spokenInput,
  });

  return {
    interviewType: interview.interviewType,
    currentPhase: phase,
    problemTitle: round.problem?.title ?? "PatternForge problem",
    difficulty: round.problem?.difficulty ?? "Medium",
    recognitionClues: round.problem?.recognitionClues ?? [],
    commonMistakes: round.problem?.commonMistakes ?? [],
    correctPattern: round.correctPattern?.name ?? getPatternName(round.correctPatternId),
    secondaryPatterns: getSecondaryPatternNames(round),
    previousMessages: [
      ...uniqueMessages([
        ...interview.messages,
        ...(round.messages ?? []),
      ]),
    ],
    previousVoiceTurns: voiceTurns.previousVoiceTurns,
    currentPhaseVoiceTurns: voiceTurns.currentPhaseVoiceTurns,
    userInput,
    userInputWasSpoken: spokenInput,
    codeExecution: toAICodeExecutionInput(buildRoundCodeExecution(round)),
    currentPhaseData: {
      selectedPatternName: round.selectedPattern?.name ?? null,
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
    },
    canRevealCorrectPattern:
      phase === "Feedback" ||
      Boolean(round.selectedPatternId && round.patternExplanation),
  };
}

function getRoundPhasesWithEvidence(round: RoundForScoring): InterviewPhase[] {
  return [
    round.patternExplanation ? "PatternHypothesis" : null,
    round.approachText ? "Approach" : null,
    round.codeText ? "Implementation" : null,
    round.testCasesText ? "Testing" : null,
    round.complexityText ? "Complexity" : null,
  ].filter((phase): phase is InterviewPhase => Boolean(phase));
}

function buildScoreCommunicationInput({
  interview,
  completedAt,
  finalFeedback,
}: {
  interview: InterviewForFinalization;
  completedAt: Date;
  finalFeedback: {
    summary: string;
    strengths: string[];
    weaknesses: string[];
    followUpRecommendations: string[];
  };
}) {
  return {
    interviewSessionId: interview.id,
    interviewTitle: interview.title,
    interviewType: interview.interviewType,
    durationMinutes: interview.durationMinutes,
    startedAt: interview.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    rounds: interview.rounds.map((round) => ({
      roundNumber: round.roundNumber,
      problemTitle: round.problem?.title ?? "PatternForge problem",
      difficulty: round.problem?.difficulty ?? "Medium",
      phases: getRoundPhasesWithEvidence(round),
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
      codeExecution: buildRoundCodeExecution(round),
    })),
    voiceTurns: interview.voiceTurns.map((voiceTurn) => ({
      phase: voiceTurn.phase,
      speaker: voiceTurn.speaker,
      transcript: voiceTurn.transcript,
      durationMs: voiceTurn.durationMs,
      createdAt: voiceTurn.createdAt.toISOString(),
    })),
    messages: interview.messages.map(toAIMessageInput),
    finalFeedback,
  };
}

function getUserVoiceTurns(interview: InterviewForFinalization) {
  return interview.voiceTurns.filter(
    (voiceTurn) => voiceTurn.speaker === "User" && voiceTurn.transcript.trim(),
  );
}

function usedVoiceInAllMajorInterviewPhases(
  interview: InterviewForFinalization,
): boolean {
  const spokenPhases = new Set(
    getUserVoiceTurns(interview).map((voiceTurn) => voiceTurn.phase),
  );

  return VOICE_REWARD_MAJOR_PHASES.every((phase) => spokenPhases.has(phase));
}

function calculateVoiceInterviewXp({
  communicationScore,
  usedAllMajorPhases,
}: {
  communicationScore: {
    clarityScore: number;
    structureScore: number;
    technicalExplanationScore: number;
  };
  usedAllMajorPhases: boolean;
}) {
  const breakdown = {
    completed: 30,
    clarityBonus: communicationScore.clarityScore >= 80 ? 20 : 0,
    structureBonus: communicationScore.structureScore >= 80 ? 20 : 0,
    technicalExplanationBonus:
      communicationScore.technicalExplanationScore >= 80 ? 20 : 0,
    allMajorPhasesBonus: usedAllMajorPhases ? 10 : 0,
  };

  return {
    total: Object.values(breakdown).reduce((total, value) => total + value, 0),
    breakdown,
  };
}

async function finalizeInterview({
  tx,
  interview,
  completedAt,
}: {
  tx: Prisma.TransactionClient;
  interview: InterviewForFinalization;
  completedAt: Date;
}) {
  const score = await scoreInterview({
    interviewType: interview.interviewType,
    durationMinutes: interview.durationMinutes,
    startedAt: interview.startedAt,
    completedAt,
    rounds: interview.rounds.map((round) => ({
      roundNumber: round.roundNumber,
      problemTitle: round.problem?.title ?? "PatternForge problem",
      difficulty: round.problem?.difficulty ?? "Medium",
      estimatedMinutes: round.problem?.estimatedMinutes ?? interview.durationMinutes,
      recognitionClues: round.problem?.recognitionClues ?? [],
      commonMistakes: round.problem?.commonMistakes ?? [],
      selectedPatternName: round.selectedPattern?.name ?? null,
      correctPatternName:
        round.correctPattern?.name ?? getPatternName(round.correctPatternId),
      secondaryPatternNames: getSecondaryPatternNames(round),
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
      codeExecution: buildRoundCodeExecution(round),
    })),
    messages: interview.messages.map(toAIMessageInput),
  });
  const artifactRound =
    interview.rounds.find((round) => round.attemptId) ??
    interview.rounds[0] ??
    null;
  const reviewDueAt = new Date();
  const previousInterview = await tx.interviewSession.findFirst({
    where: {
      userProfileId: interview.userProfileId,
      status: "Completed",
      overallScore: {
        not: null,
      },
      id: {
        not: interview.id,
      },
    },
    select: {
      overallScore: true,
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
  });
  const rewards = calculateInterviewRewards({
    overallScore: score.overallScore,
    testingScore: score.Testing,
    complexityScore: score.Complexity,
    result: score.result,
    previousOverallScore: previousInterview?.overallScore ?? null,
    rounds: interview.rounds.map((round) => ({
      selectedPatternId: round.selectedPatternId,
      correctPatternId: round.correctPatternId,
      patternExplanation: round.patternExplanation,
      approachText: round.approachText,
      codeText: round.codeText,
      testCasesText: round.testCasesText,
      complexityText: round.complexityText,
    })),
  });

  await tx.interviewRubricScore.deleteMany({
    where: {
      interviewSessionId: interview.id,
    },
  });
  await tx.communicationInsight.deleteMany({
    where: {
      interviewSessionId: interview.id,
    },
  });
  await tx.voiceFeedback.deleteMany({
    where: {
      interviewSessionId: interview.id,
    },
  });
  const finalFeedback = {
    summary: score.summary,
    strengths: score.strengths,
    weaknesses: score.weaknesses,
    followUpRecommendations: score.followUpRecommendations,
  };
  await tx.interviewFeedback.create({
    data: {
      interviewSessionId: interview.id,
      summary: finalFeedback.summary,
      strengths: finalFeedback.strengths,
      weaknesses: finalFeedback.weaknesses,
      rubric: {
        scores: {
          Communication: score.Communication,
          PatternRecognition: score.PatternRecognition,
          ProblemSolving: score.ProblemSolving,
          Implementation: score.Implementation,
          Testing: score.Testing,
          Complexity: score.Complexity,
          TimeManagement: score.TimeManagement,
        },
        missedSignals: score.missedSignals,
        suggestedMistakes: score.suggestedMistakes,
        suggestedFlashcards: score.suggestedFlashcards,
      },
      followUpRecommendations: finalFeedback.followUpRecommendations,
    },
  });
  const communicationScore = await scoreCommunication(
    buildScoreCommunicationInput({
      interview,
      completedAt,
      finalFeedback,
    }),
  );
  const communicationOverallScore = Math.max(
    1,
    clampCommunicationScore(
      (communicationScore.clarityScore +
        communicationScore.structureScore +
        communicationScore.concisenessScore +
        communicationScore.confidenceScore +
        communicationScore.technicalExplanationScore) /
        5,
    ),
  );
  const userVoiceTurns = getUserVoiceTurns(interview);

  if (userVoiceTurns.length > 0) {
    const voiceSession = await getOrCreateActiveVoiceSession({
      tx,
      userProfileId: interview.userProfileId,
      interviewSessionId: interview.id,
    });
    const voiceFeedback = await tx.voiceFeedback.create({
      data: {
        userProfileId: interview.userProfileId,
        interviewSessionId: interview.id,
        voiceSessionId: voiceSession.id,
        clarityScore: communicationScore.clarityScore,
        structureScore: communicationScore.structureScore,
        concisenessScore: communicationScore.concisenessScore,
        confidenceScore: communicationScore.confidenceScore,
        technicalExplanationScore: communicationScore.technicalExplanationScore,
        summary: communicationScore.summary,
        strengths: communicationScore.strengths,
        weaknesses: communicationScore.weaknesses,
        suggestedPractice: communicationScore.suggestedPractice,
      },
    });
    for (const insight of communicationScore.communicationInsights) {
      const communicationInsight = await tx.communicationInsight.create({
        data: {
          userProfileId: interview.userProfileId,
          interviewSessionId: interview.id,
          voiceFeedbackId: voiceFeedback.id,
          insightType: insight.insightType,
          severity: insight.severity,
          summary: insight.summary,
          evidence: insight.evidence as Prisma.InputJsonObject,
        },
      });

      await createGameEventWithClient(
        tx,
        interview.userProfileId,
        GameEventType.CommunicationInsightCreated,
        0,
        "Communication insight created",
        {
          communicationInsightId: communicationInsight.id,
          interviewId: interview.id,
          voiceFeedbackId: voiceFeedback.id,
          insightType: insight.insightType,
          severity: insight.severity,
        },
      );
    }
    await tx.voiceSession.update({
      where: {
        id: voiceSession.id,
      },
      data: {
        status: "Completed",
        completedAt,
      },
    });
    const usedAllMajorPhases = usedVoiceInAllMajorInterviewPhases(interview);
    const voiceRewards = calculateVoiceInterviewXp({
      communicationScore,
      usedAllMajorPhases,
    });

    await createGameEventWithClient(
      tx,
      interview.userProfileId,
      GameEventType.VoiceInterviewCompleted,
      voiceRewards.total,
      "Voice interview completed",
      {
        voiceSessionId: voiceSession.id,
        interviewId: interview.id,
        interviewType: interview.interviewType,
        spokenTurnCount: userVoiceTurns.length,
        usedAllMajorPhases,
        clarityScore: communicationScore.clarityScore,
        structureScore: communicationScore.structureScore,
        technicalExplanationScore: communicationScore.technicalExplanationScore,
        xpBreakdown: voiceRewards.breakdown,
      },
    );
  }
  await tx.interviewRubricScore.createMany({
    data: RUBRIC_CATEGORIES.map((category) => ({
      interviewSessionId: interview.id,
      category,
      score: score[category],
      notes: `${category} scored ${score[category]} from AI interview scoring.`,
    })),
  });
  if (artifactRound && score.suggestedFlashcards.length > 0) {
    await tx.flashcard.createMany({
      data: score.suggestedFlashcards.map((flashcard) => ({
        userProfileId: interview.userProfileId,
        sourceAttemptId: artifactRound.attemptId,
        patternId: artifactRound.correctPatternId,
        front: flashcard.front,
        back: flashcard.back,
        reviewDueAt,
      })),
    });
  }
  if (artifactRound?.attemptId && score.suggestedMistakes.length > 0) {
    await tx.mistake.createMany({
      data: score.suggestedMistakes.map((mistake) => ({
        userProfileId: interview.userProfileId,
        attemptId: artifactRound.attemptId as string,
        problemId: artifactRound.problemId,
        patternId: artifactRound.correctPatternId,
        mistakeType: mistake.mistakeType,
        description: mistake.description,
        correction: mistake.correction,
        reviewDueAt,
      })),
    });
  }
  for (const round of interview.rounds) {
    if (!round.attemptId || round.aiReviewId) {
      continue;
    }

    const aiReview = await tx.aIReview.create({
      data: {
        userProfileId: interview.userProfileId,
        attemptId: round.attemptId,
        problemId: round.problemId,
        patternId: round.correctPatternId,
        patternScore: Math.max(1, Math.round(score.PatternRecognition / 10)),
        implementationScore: Math.max(1, Math.round(score.Implementation / 10)),
        complexityScore: Math.max(1, Math.round(score.Complexity / 10)),
        explanationScore: Math.max(
          1,
          Math.round((score.Communication + score.ProblemSolving) / 20),
        ),
        feedbackSummary: score.summary,
        strengths: score.strengths,
        weaknesses: score.weaknesses,
        complexityFeedback:
          round.complexityText ??
          "Complexity was scored from the interview transcript.",
        suggestedNextStep:
          score.followUpRecommendations[0] ??
          "Repeat the interview and make the invariant explicit.",
      },
    });

    await tx.interviewRound.update({
      where: {
        interviewSessionId_roundNumber: {
          interviewSessionId: interview.id,
          roundNumber: round.roundNumber,
        },
      },
      data: {
        aiReviewId: aiReview.id,
      },
    });
  }
  await tx.interviewSession.update({
    where: {
      id: interview.id,
    },
    data: {
      status: "Completed",
      completedAt,
      overallScore: score.overallScore,
      communicationScore: communicationOverallScore,
      patternRecognitionScore: score.PatternRecognition,
      problemSolvingScore: score.ProblemSolving,
      implementationScore: score.Implementation,
      testingScore: score.Testing,
      complexityScore: score.Complexity,
      timeManagementScore: score.TimeManagement,
      result: score.result,
    },
  });
  await tx.interviewMessage.create({
    data: {
      interviewSessionId: interview.id,
      role: "Interviewer",
      phase: "Feedback",
      content:
        interview.rounds.some((round) => buildRoundCodeExecution(round))
          ? "Interview complete. Feedback and rubric scores are saved below. I used PatternForge custom run output where it was available; this is not an official correctness result."
          : "Interview complete. Feedback and rubric scores are saved below. Code was not run in PatternForge, so implementation confidence is limited.",
    },
  });
  await createGameEventWithClient(
    tx,
    interview.userProfileId,
    GameEventType.InterviewCompleted,
    rewards.completedXp,
    "Interview completed",
    {
      interviewId: interview.id,
      interviewType: interview.interviewType,
      result: score.result,
      overallScore: score.overallScore,
      xpBreakdown: rewards.breakdown,
    },
  );
  if (rewards.strongResult) {
    await createGameEventWithClient(
      tx,
      interview.userProfileId,
      GameEventType.InterviewStrongResult,
      rewards.strongResultXp,
      "Strong interview result",
      {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        result: score.result,
        overallScore: score.overallScore,
      },
    );
  }
  if (rewards.improvedByAtLeast20) {
    await createGameEventWithClient(
      tx,
      interview.userProfileId,
      GameEventType.InterviewImprovement,
      rewards.improvementXp,
      "Interview score improved by 20+ points",
      {
        interviewId: interview.id,
        interviewType: interview.interviewType,
        result: score.result,
        overallScore: score.overallScore,
        previousOverallScore: previousInterview?.overallScore ?? null,
        improvedBy: rewards.improvedBy,
      },
    );
  }
  await checkAchievementsWithClient(tx, interview.userProfileId);
}

export async function saveInterviewPhaseAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");
  const roundId = readString(formData, "roundId");
  const phase = readPhase(formData);

  if (!interviewId || !roundId || !phase) {
    redirect("/interviews");
  }

  try {
    await getPrisma().$transaction(async (tx) => {
      const interview = await tx.interviewSession.findFirst({
        where: {
          id: interviewId,
          userProfileId: userProfile.id,
        },
        include: {
          rounds: {
            include: interviewRoundAIInclude,
            orderBy: {
              roundNumber: "asc",
            },
          },
          messages: true,
          voiceTurns: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

      if (!interview || interview.status !== "Active") {
        throw new Error("Interview is not active.");
      }
      const activeInterview = interview;

      const round = interview.rounds.find(
        (interviewRound) => interviewRound.id === roundId,
      );

      if (!round || round.status === "Completed" || round.status === "Skipped") {
        throw new Error("Interview round is not active.");
      }
      const activeRound = round;
      const activePhase = phase;

      const userMessageData = {
        interviewSessionId: activeInterview.id,
        interviewRoundId: activeRound.id,
        role: "User" as const,
        phase: activePhase,
      };
      const interviewerMessageData = {
        interviewSessionId: activeInterview.id,
        interviewRoundId: activeRound.id,
        role: "Interviewer" as const,
        phase: activePhase,
      };

      async function getAIMessage(nextRoundState = activeRound, userInput = "") {
        const response = await requestAIInterviewerResponse(
          buildAIInterviewerInput({
            interview: activeInterview,
            round: nextRoundState,
            phase: activePhase,
            userInput,
            userInputWasSpoken: hasAcceptedVoiceTranscript(formData),
          }),
        );

        return response.interviewerMessage;
      }

      if (activePhase === "Setup") {
        await tx.interviewMessage.create({
          data: {
            ...interviewerMessageData,
            content: await getAIMessage(activeRound, ""),
          },
        });
        await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { status: "Active" },
        });
        return;
      }

      if (activePhase === "ClarifyingQuestions") {
        const content = requireText(
          readString(formData, "clarifyingQuestions"),
          "Clarifying questions or assumptions are required.",
        );

        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: content,
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(round, content),
            },
          ],
        });
        return;
      }

      if (activePhase === "PatternHypothesis") {
        const selectedPatternId = requireText(
          readString(formData, "selectedPatternId"),
          "Pattern selection is required.",
        );
        const patternExplanation = requireText(
          readString(formData, "patternExplanation"),
          "Pattern explanation is required.",
        );

        if (!patterns.some((pattern) => pattern.id === selectedPatternId)) {
          throw new Error("Selected pattern is not valid.");
        }

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: {
            selectedPatternId,
            patternExplanation,
          },
          include: interviewRoundAIInclude,
        });
        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: patternExplanation,
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: `${getPatternName(selectedPatternId)}\n\n${patternExplanation}`,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, patternExplanation),
            },
          ],
        });
        return;
      }

      if (activePhase === "Approach") {
        const approachText = requireText(
          readString(formData, "approachText"),
          "Approach is required.",
        );

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { approachText },
          include: interviewRoundAIInclude,
        });
        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: approachText,
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: approachText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, approachText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Implementation") {
        const savedCodeText = readString(formData, "codeText");
        const hasWorkspaceCode = await hasInterviewRoundCodeSubmission({
          tx,
          userProfileId: userProfile.id,
          problemId: activeRound.problemId,
          interviewRoundId: activeRound.id,
        });
        const codeText =
          savedCodeText ||
          (hasWorkspaceCode
            ? "Implemented in PatternForge Code Workspace."
            : requireText(
                savedCodeText,
                "Implementation notes, code, or a saved workspace submission are required.",
              ));

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { codeText },
          include: interviewRoundAIInclude,
        });
        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: codeText,
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: codeText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, codeText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Testing") {
        const savedTestCasesText = readString(formData, "testCasesText");
        const hasWorkspaceRun = await hasInterviewRoundCodeRun({
          tx,
          userProfileId: userProfile.id,
          problemId: activeRound.problemId,
          interviewRoundId: activeRound.id,
        });
        const testCasesText =
          savedTestCasesText ||
          (hasWorkspaceRun
            ? "Custom tests were run in PatternForge Code Workspace."
            : requireText(
                savedTestCasesText,
                "Test cases, edge cases, or a saved workspace run are required.",
              ));

        const updatedRound = await tx.interviewRound.update({
          where: { id: activeRound.id },
          data: { testCasesText },
          include: interviewRoundAIInclude,
        });
        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: testCasesText,
        });
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: testCasesText,
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, testCasesText),
            },
          ],
        });
        return;
      }

      if (activePhase === "Complexity") {
        const completedAt = new Date();
        const complexityText = requireText(
          readString(formData, "complexityText"),
          "Time and space complexity are required.",
        );
        const solvedStatus = readSolvedStatus(formData);
        const confidence = readConfidence(formData);
        const timeSpentMinutes = readPositiveInt(
          formData,
          "timeSpentMinutes",
          Math.max(
            1,
            Math.round(
              (completedAt.getTime() - activeRound.startedAt.getTime()) /
                (1000 * 60),
            ),
          ),
        );
        const nextRound = interview.rounds.find(
          (candidateRound) => candidateRound.roundNumber === activeRound.roundNumber + 1,
        );

        const completionUpdate = await tx.interviewRound.updateMany({
          where: {
            id: activeRound.id,
            status: "Active",
          },
          data: {
            complexityText,
            status: "Completed",
            completedAt,
          },
        });

        if (completionUpdate.count === 0) {
          throw new Error("Interview round was already completed.");
        }

        let updatedRound = await tx.interviewRound.findUniqueOrThrow({
          where: { id: activeRound.id },
          include: interviewRoundAIInclude,
        });
        await saveVoiceTurnIfAccepted({
          tx,
          formData,
          userProfileId: userProfile.id,
          interviewSessionId: activeInterview.id,
          interviewRoundId: activeRound.id,
          phase: activePhase,
          transcript: complexityText,
        });
        if (!updatedRound.attemptId) {
          if (!updatedRound.selectedPatternId) {
            throw new Error("Pattern hypothesis must be saved before feedback.");
          }

          const attemptInput: CreateAttemptInput = {
            problemId: updatedRound.problemId,
            selectedPatternId: updatedRound.selectedPatternId,
            solvedStatus,
            timeSpentMinutes,
            confidence,
            reflection: buildAttemptReflection({
              round: updatedRound,
              solvedStatus,
              confidence,
            }),
          };
          const attempt = await createAttemptForUserProfileWithClient(
            tx,
            userProfile.id,
            attemptInput,
          );

          updatedRound = await tx.interviewRound.update({
            where: { id: activeRound.id },
            data: {
              attemptId: attempt.id,
            },
            include: interviewRoundAIInclude,
          });
        }
        await tx.interviewMessage.createMany({
          data: [
            {
              ...userMessageData,
              content: [
                complexityText,
                `Self-reported status: ${solvedStatus}`,
                `Time spent: ${timeSpentMinutes} min`,
                `Confidence: ${confidence}/5`,
              ].join("\n\n"),
            },
            {
              ...interviewerMessageData,
              content: await getAIMessage(updatedRound, complexityText),
            },
          ],
        });

        if (nextRound) {
          await tx.interviewRound.update({
            where: { id: nextRound.id },
            data: {
              status: "Active",
              startedAt: completedAt,
            },
          });
          return;
        }

        const refreshedInterview = await tx.interviewSession.findFirst({
          where: {
            id: interview.id,
            userProfileId: userProfile.id,
          },
          include: {
            rounds: {
              include: interviewRoundAIInclude,
              orderBy: {
                roundNumber: "asc",
              },
            },
            messages: true,
            voiceTurns: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        });

        if (!refreshedInterview) {
          throw new Error("Interview could not be finalized.");
        }

        await finalizeInterview({
          tx,
          interview: refreshedInterview,
          completedAt,
        });
      }
    });
  } catch {
    redirect(`/interviews/${interviewId}?error=save`);
  }

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/summary`);
  redirect(`/interviews/${interviewId}`);
}

export async function abandonInterviewAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/interviews?error=signin");
  }

  const interviewId = readString(formData, "interviewId");

  if (!interviewId) {
    redirect("/interviews");
  }

  await getPrisma().$transaction(async (tx) => {
    const update = await tx.interviewSession.updateMany({
      where: {
        id: interviewId,
        userProfileId: userProfile.id,
        status: "Active",
      },
      data: {
        status: "Abandoned",
        completedAt: new Date(),
      },
    });

    if (update.count === 0) {
      return;
    }

    await tx.interviewRound.updateMany({
      where: {
        interviewSessionId: interviewId,
        status: {
          in: ["Active", "Pending"],
        },
      },
      data: {
        status: "Skipped",
        completedAt: new Date(),
      },
    });
  });

  revalidatePath("/interviews");
  revalidatePath(`/interviews/${interviewId}`);
  redirect("/interviews");
}
