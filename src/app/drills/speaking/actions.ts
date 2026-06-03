"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";

import type { InterviewPhase } from "@/generated/prisma/enums";
import { GameEventType } from "@/generated/prisma/enums";
import {
  scoreCommunication,
  type ScoreCommunicationOutput,
} from "@/lib/ai/scoreCommunication";
import { checkAchievements } from "@/lib/achievements/service";
import { createGameEvent } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import { createManualTranscriptionOutput, transcribeInterviewTurn } from "@/lib/voice/transcription";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/voice/voiceLimits";

import type {
  SpeakingDrillPrompt,
  SpeakingDrillType,
  SpeakingScoreResult,
  SpeakingStudyCardActionResult,
} from "./types";

type TranscribeSpeakingDrillResult =
  | {
      status: "success";
      transcript: string;
      durationMs?: number;
    }
  | {
      status: "fallback";
      message: string;
    };

type ScoreSpeakingDrillInput = {
  prompt: SpeakingDrillPrompt;
  transcript: string;
  durationMs?: number | null;
};

type ScoreSpeakingDrillActionResult =
  | {
      status: "success";
      feedback: SpeakingScoreResult;
    }
  | {
      status: "invalid" | "unauthenticated";
      message: string;
    };

type CreateSpeakingStudyCardInput = {
  prompt: SpeakingDrillPrompt;
  transcript: string;
  feedbackSummary: string;
};

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readDurationMs(formData: FormData): number | undefined {
  const value = Number(readString(formData, "durationMs"));

  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

function buildSpeakingDrillId({
  userProfileId,
  promptId,
  transcript,
}: {
  userProfileId: string;
  promptId: string;
  transcript: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        userProfileId,
        promptId,
        transcript: transcript.trim().replace(/\s+/g, " ").toLowerCase(),
      }),
    )
    .digest("hex")
    .slice(0, 32);
}

function getPhaseForDrillType(drillType: SpeakingDrillType): InterviewPhase {
  switch (drillType) {
    case "pattern":
      return "PatternHypothesis";
    case "approach":
    case "debugging":
      return "Approach";
    case "complexity":
      return "Complexity";
  }
}

function toSpeakingScoreResult(
  feedback: ScoreCommunicationOutput,
): SpeakingScoreResult {
  return {
    clarityScore: feedback.clarityScore,
    structureScore: feedback.structureScore,
    concisenessScore: feedback.concisenessScore,
    confidenceScore: feedback.confidenceScore,
    technicalExplanationScore: feedback.technicalExplanationScore,
    summary: feedback.summary,
    strengths: feedback.strengths,
    weaknesses: feedback.weaknesses,
    suggestedPractice: feedback.suggestedPractice,
    insights: feedback.communicationInsights.map((insight) => ({
      insightType: insight.insightType,
      severity: insight.severity,
      summary: insight.summary,
    })),
  };
}

function buildRoundInput({
  prompt,
  transcript,
}: {
  prompt: SpeakingDrillPrompt;
  transcript: string;
}): Parameters<typeof scoreCommunication>[0]["rounds"][number] {
  return {
    roundNumber: 1,
    problemTitle: prompt.contextTitle,
    difficulty: prompt.difficulty ?? "Medium",
    phases: [prompt.phase],
    patternExplanation: prompt.drillType === "pattern" ? transcript : null,
    approachText:
      prompt.drillType === "approach" || prompt.drillType === "debugging"
        ? transcript
        : null,
    testCasesText: prompt.drillType === "debugging" ? transcript : null,
    complexityText: prompt.drillType === "complexity" ? transcript : null,
    codeExecution:
      prompt.drillType === "debugging"
        ? {
            didRun: true,
            latestRunStatus: "Failed",
            runtimeMs: null,
            totalTests: 0,
            testsPassed: 0,
            testsFailed: 1,
            successfulRunCount: 0,
            failedRunCount: 1,
            userCreatedTestCount: 0,
            fixedAfterFailedRun: false,
            stdout: "",
            stderr: "",
            runtimeError: "Speaking drill prompt used a previous failed run.",
            failedTestSummaries: [],
          }
        : null,
  };
}

export async function transcribeSpeakingDrillAction(
  formData: FormData,
): Promise<TranscribeSpeakingDrillResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return {
      status: "fallback",
      message: "Sign in before using Voice Mode.",
    };
  }

  const drillType = readString(formData, "drillType") as SpeakingDrillType;
  const audio = formData.get("audio");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return {
      status: "fallback",
      message: "No audio was captured. Type your answer manually.",
    };
  }

  const result = await transcribeInterviewTurn({
    audioBlob: audio,
    durationMs: readDurationMs(formData),
    phase: getPhaseForDrillType(drillType),
    interviewSessionId: "speaking-practice",
  });

  if (result.status === "success") {
    return {
      status: "success",
      transcript: result.output.transcript,
      durationMs: result.output.durationMs,
    };
  }

  return {
    status: "fallback",
    message: result.message,
  };
}

export async function scoreSpeakingDrillAction(
  input: ScoreSpeakingDrillInput,
): Promise<ScoreSpeakingDrillActionResult> {
  const userProfile = await ensureCurrentUserProfile();
  const transcript = input.transcript.trim();

  if (!userProfile) {
    return {
      status: "unauthenticated",
      message: "Sign in before scoring speaking practice.",
    };
  }

  if (!transcript || transcript.length > MAX_TRANSCRIPT_LENGTH) {
    return {
      status: "invalid",
      message: `Transcript must be between 1 and ${MAX_TRANSCRIPT_LENGTH.toLocaleString()} characters.`,
    };
  }

  const manualTranscript = createManualTranscriptionOutput({
    transcript,
    durationMs: input.durationMs ?? undefined,
  });
  const completedAt = new Date();
  const feedback = await scoreCommunication({
    interviewSessionId: `speaking-practice:${input.prompt.id}`,
    interviewTitle: `Speaking practice: ${input.prompt.title}`,
    interviewType: "SingleProblem",
    durationMinutes: Math.max(
      1,
      Math.round((manualTranscript.durationMs ?? 60_000) / 60_000),
    ),
    startedAt: new Date(
      completedAt.getTime() - (manualTranscript.durationMs ?? 60_000),
    ).toISOString(),
    completedAt: completedAt.toISOString(),
    rounds: [
      buildRoundInput({
        prompt: input.prompt,
        transcript: manualTranscript.transcript,
      }),
    ],
    voiceTurns: [
      {
        phase: input.prompt.phase,
        speaker: "User",
        transcript: manualTranscript.transcript,
        durationMs: manualTranscript.durationMs ?? null,
        createdAt: completedAt.toISOString(),
      },
    ],
    messages: [
      {
        role: "Interviewer",
        phase: input.prompt.phase,
        content: [
          input.prompt.description,
          ...input.prompt.focusChecklist.map((item) => `- ${item}`),
        ].join("\n"),
      },
      {
        role: "User",
        phase: input.prompt.phase,
        content: manualTranscript.transcript,
      },
    ],
    finalFeedback: null,
  });
  const averageScore = Math.round(
    (feedback.clarityScore +
      feedback.structureScore +
      feedback.concisenessScore +
      feedback.confidenceScore +
      feedback.technicalExplanationScore) /
      5,
  );
  const speakingDrillId = buildSpeakingDrillId({
    userProfileId: userProfile.id,
    promptId: input.prompt.id,
    transcript: manualTranscript.transcript,
  });

  await createGameEvent(
    userProfile.id,
    GameEventType.SpeakingDrillCompleted,
    15,
    "Speaking drill completed",
    {
      speakingDrillId,
      promptId: input.prompt.id,
      drillType: input.prompt.drillType,
      phase: input.prompt.phase,
      scoreAverage: averageScore,
      clarityScore: feedback.clarityScore,
      structureScore: feedback.structureScore,
      technicalExplanationScore: feedback.technicalExplanationScore,
    },
  );
  await checkAchievements(userProfile.id);
  revalidatePath("/");
  revalidatePath("/achievements");

  return {
    status: "success",
    feedback: toSpeakingScoreResult(feedback),
  };
}

export async function createSpeakingPracticeFlashcardAction(
  input: CreateSpeakingStudyCardInput,
): Promise<SpeakingStudyCardActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return {
      status: "unauthenticated",
      message: "Sign in before creating a flashcard.",
    };
  }

  if (!input.prompt.patternId) {
    return {
      status: "invalid",
      message: "This drill does not have enough pattern context for a flashcard.",
    };
  }

  await getPrisma().flashcard.create({
    data: {
      userProfileId: userProfile.id,
      patternId: input.prompt.patternId,
      sourceAttemptId: input.prompt.attemptId,
      front: `Improve this spoken explanation: ${input.prompt.title}`,
      back: [
        input.feedbackSummary,
        "Transcript excerpt:",
        input.transcript.trim().slice(0, 900),
      ].join("\n\n"),
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/review");

  return {
    status: "created",
    message: "Flashcard created from speaking practice.",
  };
}

export async function createSpeakingPracticeMistakeAction(
  input: CreateSpeakingStudyCardInput,
): Promise<SpeakingStudyCardActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return {
      status: "unauthenticated",
      message: "Sign in before creating a mistake.",
    };
  }

  if (!input.prompt.attemptId) {
    return {
      status: "invalid",
      message: "Mistake cards require a saved attempt context.",
    };
  }

  const attempt = await getPrisma().attempt.findFirst({
    where: {
      id: input.prompt.attemptId,
      userProfileId: userProfile.id,
    },
    select: {
      id: true,
      problemId: true,
      correctPatternId: true,
    },
  });

  if (!attempt) {
    return {
      status: "invalid",
      message: "Saved attempt context was not found.",
    };
  }

  await getPrisma().mistake.create({
    data: {
      userProfileId: userProfile.id,
      attemptId: attempt.id,
      problemId: attempt.problemId,
      patternId: attempt.correctPatternId,
      mistakeType: "Speaking practice",
      description: input.feedbackSummary,
      correction:
        "Practice a shorter spoken answer that states the signal, invariant, plan, edge cases, and complexity before implementation details.",
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/mistakes");
  revalidatePath("/review");

  return {
    status: "created",
    message: "Mistake created from speaking practice.",
  };
}
