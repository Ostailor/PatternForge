"use server";

import { redirect } from "next/navigation";

import {
  CurrentLevel,
  DiagnosticQuestionType,
  DiagnosticStatus,
} from "@/generated/prisma/enums";
import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { ensureStartingPathForUser } from "@/lib/learning-plans/startingPath";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import { diagnosticProblemIds } from "./diagnostic-data";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

function readConfidence(formData: FormData): number {
  const confidence = Number(readString(formData, "confidence"));

  return Number.isInteger(confidence) && confidence >= 1 && confidence <= 5
    ? confidence
    : 3;
}

function readKnownPatternIds(formData: FormData): string[] {
  const validPatternIds = new Set(patterns.map((pattern) => pattern.id));

  return formData
    .getAll("knownPatterns")
    .filter(
      (value): value is string =>
        typeof value === "string" && validPatternIds.has(value),
    );
}

function getRecognitionResults(formData: FormData) {
  return diagnosticProblemIds.map((problemId) => {
    const problem = problems.find((item) => item.id === problemId);

    if (!problem) {
      throw new Error(`Diagnostic problem ${problemId} is missing.`);
    }

    const selectedPatternId = readString(formData, `pattern:${problem.id}`);
    const wasCorrect = selectedPatternId === problem.primaryPatternId;

    return {
      problem,
      selectedPatternId,
      wasCorrect,
    };
  });
}

function estimateLevel({
  correctCount,
  confidence,
  knownPatternCount,
}: {
  correctCount: number;
  confidence: number;
  knownPatternCount: number;
}): CurrentLevel {
  if (correctCount >= 5 && confidence >= 4 && knownPatternCount >= 6) {
    return CurrentLevel.Advanced;
  }

  if (correctCount >= 4 && confidence >= 3) {
    return CurrentLevel.InterviewPrep;
  }

  if (correctCount >= 2 || confidence >= 3 || knownPatternCount >= 2) {
    return CurrentLevel.SomeExperience;
  }

  return CurrentLevel.Beginner;
}

function getRecommendedStartPatternId({
  recognitionResults,
  knownPatternIds,
  estimatedLevel,
}: {
  recognitionResults: ReturnType<typeof getRecognitionResults>;
  knownPatternIds: string[];
  estimatedLevel: CurrentLevel;
}): string {
  const missedPatternIds = recognitionResults
    .filter((result) => !result.wasCorrect)
    .map((result) => result.problem.primaryPatternId);
  const missedPattern = patterns
    .filter((pattern) => missedPatternIds.includes(pattern.id))
    .sort((left, right) => left.levelOrder - right.levelOrder)[0];

  if (missedPattern) {
    return missedPattern.id;
  }

  if (estimatedLevel === CurrentLevel.Beginner) {
    return "arrays-hashing";
  }

  const nextUnknownPattern = patterns
    .filter((pattern) => !knownPatternIds.includes(pattern.id))
    .sort((left, right) => left.levelOrder - right.levelOrder)[0];

  return nextUnknownPattern?.id ?? "sliding-window";
}

function buildPrompt(problem: (typeof problems)[number]): string {
  return [
    `Problem title: ${problem.title}`,
    `Difficulty: ${problem.difficulty}`,
    `Recognition clues: ${problem.recognitionClues.join("; ")}`,
  ].join("\n");
}

export async function submitDiagnosticAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    redirect("/onboarding/diagnostic");
  }

  const recognitionResults = getRecognitionResults(formData);
  const correctCount = recognitionResults.filter((result) => result.wasCorrect)
    .length;
  const confidence = readConfidence(formData);
  const knownPatternIds = readKnownPatternIds(formData);
  const estimatedLevel = estimateLevel({
    correctCount,
    confidence,
    knownPatternCount: knownPatternIds.length,
  });
  const recommendedStartPatternId = getRecommendedStartPatternId({
    recognitionResults,
    knownPatternIds,
    estimatedLevel,
  });
  const completedAt = new Date();

  const assessment = await getPrisma().$transaction(async (client) => {
    const existingAssessment = await client.diagnosticAssessment.findFirst({
      where: {
        userProfileId: userProfile.id,
        status: DiagnosticStatus.InProgress,
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    const assessmentRecord = existingAssessment
      ? await client.diagnosticAssessment.update({
          where: { id: existingAssessment.id },
          data: {
            status: DiagnosticStatus.Completed,
            completedAt,
            overallLevel: estimatedLevel,
            recommendedStartPatternId,
          },
          select: { id: true },
        })
      : await client.diagnosticAssessment.create({
          data: {
            userProfileId: userProfile.id,
            status: DiagnosticStatus.Completed,
            startedAt: completedAt,
            completedAt,
            overallLevel: estimatedLevel,
            recommendedStartPatternId,
          },
          select: { id: true },
        });

    await client.diagnosticQuestion.deleteMany({
      where: { assessmentId: assessmentRecord.id },
    });

    await client.diagnosticQuestion.createMany({
      data: [
        ...recognitionResults.map((result) => ({
          assessmentId: assessmentRecord.id,
          questionType: DiagnosticQuestionType.PatternRecognition,
          prompt: buildPrompt(result.problem),
          patternId: result.problem.primaryPatternId,
          problemId: result.problem.id,
          selectedAnswer: result.selectedPatternId,
          correctAnswer: result.problem.primaryPatternId,
          wasCorrect: result.wasCorrect,
        })),
        {
          assessmentId: assessmentRecord.id,
          questionType: DiagnosticQuestionType.ConfidenceCheck,
          prompt: "How confident are you recognizing coding interview patterns today?",
          selectedAnswer: String(confidence),
          correctAnswer: null,
          wasCorrect: null,
          confidence,
        },
        {
          assessmentId: assessmentRecord.id,
          questionType: DiagnosticQuestionType.ExperienceQuestion,
          prompt: "Which PatternForge patterns do you already know?",
          selectedAnswer: JSON.stringify(knownPatternIds),
          correctAnswer: null,
          wasCorrect: null,
        },
      ],
    });

    await client.userSettings.upsert({
      where: { userProfileId: userProfile.id },
      update: { currentLevel: estimatedLevel },
      create: {
        userProfileId: userProfile.id,
        currentLevel: estimatedLevel,
      },
    });

    const startingPath = await ensureStartingPathForUser({
      client,
      userProfileId: userProfile.id,
      diagnosticAssessmentId: assessmentRecord.id,
      refreshExisting: true,
    });

    await client.diagnosticAssessment.update({
      where: { id: assessmentRecord.id },
      data: {
        recommendedPlanId: startingPath.planId,
      },
      select: { id: true },
    });

    return assessmentRecord;
  });

  await trackEvent({
    eventName: AnalyticsEvents.DiagnosticCompleted,
    userProfileId: userProfile.id,
    properties: {
      assessmentId: assessment.id,
      correctCount,
      questionCount: recognitionResults.length + 2,
      confidence,
      knownPatternCount: knownPatternIds.length,
      estimatedLevel,
      recommendedStartPatternId,
    },
  });

  redirect(`/onboarding/diagnostic/result?assessmentId=${assessment.id}`);
}
