import {
  DAILY_AI_REVIEW_LIMIT,
  getDailyReviewWindow,
} from "@/lib/ai-review-limits";
import type {
  AIReviewInput,
  AIReviewOutput,
  SavedAIReview,
} from "@/lib/ai/types";
import { getPrisma } from "@/lib/prisma";

export type CreateAIReviewInput = {
  attemptId: string;
  userCode: string;
  userExplanation: string;
};

export type ReviewSolution = (input: AIReviewInput) => Promise<AIReviewOutput>;

export class AIReviewAttemptAccessError extends Error {
  constructor() {
    super("Attempt was not found for the current user.");
    this.name = "AIReviewAttemptAccessError";
  }
}

export class AIReviewDailyLimitError extends Error {
  constructor() {
    super("Daily AI review limit reached.");
    this.name = "AIReviewDailyLimitError";
  }
}

function unique(values: string[]): string[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  );
}

function buildAIReviewInput(
  attempt: NonNullable<
    Awaited<ReturnType<typeof getAttemptForAIReview>>
  >,
  input: CreateAIReviewInput,
): AIReviewInput {
  const secondaryPatternNames = attempt.problem.problemPatterns
    .filter((problemPattern) => !problemPattern.isPrimary)
    .map((problemPattern) => problemPattern.pattern.name);

  // Product boundary: PatternForge does not scrape LeetCode and does not store
  // full LeetCode statements. AI review uses only user-provided content plus
  // PatternForge-owned metadata such as titles, clues, mistakes, and patterns.
  return {
    problemTitle: attempt.problem.title,
    difficulty: attempt.problem.difficulty,
    patternName: attempt.correctPattern.name,
    secondaryPatternNames,
    recognitionClues: unique([
      ...attempt.problem.recognitionClues,
      ...attempt.correctPattern.recognitionClues,
    ]),
    commonMistakes: unique([
      ...attempt.problem.commonMistakes,
      ...attempt.correctPattern.commonMistakes,
    ]),
    userSelectedPattern: attempt.selectedPattern.name,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus:
      attempt.solvedStatus === "PartiallySolved"
        ? "Partially Solved"
        : attempt.solvedStatus === "NotSolved"
          ? "Not Solved"
          : "Solved",
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: attempt.confidence,
    reflection: attempt.reflection,
    userCode: input.userCode.trim(),
    userExplanation: input.userExplanation.trim(),
  };
}

async function getAttemptForAIReview(attemptId: string, userProfileId: string) {
  return getPrisma().attempt.findFirst({
    where: {
      id: attemptId,
      userProfileId,
    },
    include: {
      problem: {
        include: {
          problemPatterns: {
            include: {
              pattern: true,
            },
          },
        },
      },
      selectedPattern: true,
      correctPattern: true,
    },
  });
}

export async function createAIReviewForUserProfile(
  input: CreateAIReviewInput,
  userProfileId: string,
  reviewer: ReviewSolution,
): Promise<SavedAIReview> {
  const prisma = getPrisma();
  const attempt = await getAttemptForAIReview(input.attemptId, userProfileId);

  if (!attempt) {
    throw new AIReviewAttemptAccessError();
  }

  const { start, end } = getDailyReviewWindow();
  const reviewCountToday = await prisma.aIReview.count({
    where: {
      userProfileId,
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });

  if (reviewCountToday >= DAILY_AI_REVIEW_LIMIT) {
    throw new AIReviewDailyLimitError();
  }

  const aiInput = buildAIReviewInput(attempt, input);
  const review = await reviewer(aiInput);
  const reviewDueAt = new Date();

  const savedReview = await prisma.$transaction(async (tx) => {
    const aiReview = await tx.aIReview.create({
      data: {
        userProfileId,
        attemptId: attempt.id,
        problemId: attempt.problemId,
        patternId: attempt.correctPatternId,
        patternScore: review.patternScore,
        implementationScore: review.implementationScore,
        complexityScore: review.complexityScore,
        explanationScore: review.explanationScore,
        feedbackSummary: review.feedbackSummary,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        complexityFeedback: review.complexityFeedback,
        suggestedNextStep: review.suggestedNextStep,
      },
    });

    if (review.suggestedMistakes.length > 0) {
      await tx.mistake.createMany({
        data: review.suggestedMistakes.map((mistake) => ({
          userProfileId,
          attemptId: attempt.id,
          problemId: attempt.problemId,
          patternId: attempt.correctPatternId,
          mistakeType: mistake.mistakeType,
          description: mistake.description,
          correction: mistake.correction,
          reviewDueAt,
        })),
      });
    }

    if (review.suggestedFlashcards.length > 0) {
      await tx.flashcard.createMany({
        data: review.suggestedFlashcards.map((flashcard) => ({
          userProfileId,
          sourceAttemptId: attempt.id,
          patternId: attempt.correctPatternId,
          front: flashcard.front,
          back: flashcard.back,
          reviewDueAt,
        })),
      });
    }

    return aiReview;
  });

  return {
    ...review,
    id: savedReview.id,
    attemptId: savedReview.attemptId,
    problemId: savedReview.problemId,
    patternId: savedReview.patternId,
    problemTitle: attempt.problem.title,
    patternName: attempt.correctPattern.name,
    createdAt: savedReview.createdAt.toISOString(),
  };
}
