import "server-only";

import {
  createAIReviewForUserProfile,
  type CreateAIReviewInput,
  AIReviewAttemptAccessError,
  AIReviewDailyLimitError,
} from "@/lib/ai-review-service";
import { reviewSolution } from "@/lib/ai/reviewSolution";
import type { SavedAIReview } from "@/lib/ai/types";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export {
  AIReviewAttemptAccessError,
  AIReviewDailyLimitError,
  createAIReviewForUserProfile,
  type CreateAIReviewInput,
};

export type ReviewDashboardData = {
  aiReviews: {
    id: string;
    problemTitle: string;
    patternName: string;
    patternScore: number;
    implementationScore: number;
    complexityScore: number;
    explanationScore: number;
    feedbackSummary: string;
    suggestedNextStep: string;
    createdAt: string;
  }[];
  mistakes: {
    id: string;
    mistakeType: string;
    description: string;
    correction: string;
    problemTitle: string;
    patternName: string;
    createdAt: string;
  }[];
  flashcards: {
    id: string;
    front: string;
    back: string;
    patternName: string;
    sourceProblemTitle: string | null;
    createdAt: string;
  }[];
};

export async function createCurrentUserAIReview(
  input: CreateAIReviewInput,
): Promise<SavedAIReview | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  return createAIReviewForUserProfile(input, userProfile.id, reviewSolution);
}

export async function getCurrentUserReviewDashboard(): Promise<ReviewDashboardData | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const prisma = getPrisma();
  const [aiReviews, mistakes, flashcards] = await Promise.all([
    prisma.aIReview.findMany({
      where: { userProfileId: userProfile.id },
      include: {
        problem: true,
        pattern: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.mistake.findMany({
      where: { userProfileId: userProfile.id },
      include: {
        problem: true,
        pattern: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    prisma.flashcard.findMany({
      where: { userProfileId: userProfile.id },
      include: {
        pattern: true,
        sourceAttempt: {
          include: {
            problem: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
  ]);

  return {
    aiReviews: aiReviews.map((review) => ({
      id: review.id,
      problemTitle: review.problem.title,
      patternName: review.pattern.name,
      patternScore: review.patternScore,
      implementationScore: review.implementationScore,
      complexityScore: review.complexityScore,
      explanationScore: review.explanationScore,
      feedbackSummary: review.feedbackSummary,
      suggestedNextStep: review.suggestedNextStep,
      createdAt: review.createdAt.toISOString(),
    })),
    mistakes: mistakes.map((mistake) => ({
      id: mistake.id,
      mistakeType: mistake.mistakeType,
      description: mistake.description,
      correction: mistake.correction,
      problemTitle: mistake.problem.title,
      patternName: mistake.pattern.name,
      createdAt: mistake.createdAt.toISOString(),
    })),
    flashcards: flashcards.map((flashcard) => ({
      id: flashcard.id,
      front: flashcard.front,
      back: flashcard.back,
      patternName: flashcard.pattern.name,
      sourceProblemTitle: flashcard.sourceAttempt?.problem.title ?? null,
      createdAt: flashcard.createdAt.toISOString(),
    })),
  };
}
