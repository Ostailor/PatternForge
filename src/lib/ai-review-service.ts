import {
  DAILY_AI_REVIEW_LIMIT,
  getDailyReviewWindow,
} from "@/lib/ai-review-limits";
import type {
  AIReviewInput,
  AIReviewOutput,
  SavedAIReview,
} from "@/lib/ai/types";
import { checkAchievements } from "@/lib/achievements/service";
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

function buildCodeExecutionInput(
  attempt: NonNullable<
    Awaited<ReturnType<typeof getAttemptForAIReview>>
  >,
): AIReviewInput["codeExecution"] {
  const latestSubmission = attempt.codeSubmissions[0];
  const latestRun = latestSubmission?.codeRuns[0];

  if (!latestRun) {
    return null;
  }

  const failedTestResults = latestRun.testResults.filter(
    (testResult) => !testResult.passed,
  );

  return {
    runStatus: latestRun.status,
    runtimeMs: latestRun.runtimeMs,
    testsPassed: latestRun.testResults.length - failedTestResults.length,
    testsFailed: failedTestResults.length,
    failedTestSummaries: failedTestResults.slice(0, 5).map((testResult) => ({
      name: testResult.name,
      inputJson: testResult.inputJson,
      expectedOutputJson: testResult.expectedOutputJson,
      actualOutputJson: testResult.actualOutputJson,
      errorMessage: testResult.errorMessage,
    })),
    stdout: latestRun.stdout,
    stderr: latestRun.stderr,
    runtimeError: latestRun.errorMessage,
  };
}

function getLatestWorkspaceCode(
  attempt: NonNullable<
    Awaited<ReturnType<typeof getAttemptForAIReview>>
  >,
): string {
  return attempt.codeSubmissions[0]?.code ?? "";
}

function getLatestDebugInsight(
  attempt: NonNullable<
    Awaited<ReturnType<typeof getAttemptForAIReview>>
  >,
): AIReviewInput["latestDebugInsight"] {
  const insight = attempt.debugInsights[0];

  return insight
    ? {
        summary: insight.summary,
        likelyCause: insight.likelyCause,
        suggestedFix: insight.suggestedFix,
      }
    : null;
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
  const pastedCode = input.userCode.trim();
  const workspaceCode = getLatestWorkspaceCode(attempt);

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
    userCode: pastedCode || workspaceCode,
    userExplanation: input.userExplanation.trim(),
    codeExecution: buildCodeExecutionInput(attempt),
    latestDebugInsight: getLatestDebugInsight(attempt),
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
      debugInsights: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
      codeSubmissions: {
        orderBy: {
          updatedAt: "desc",
        },
        take: 1,
        include: {
          codeRuns: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            include: {
              testResults: {
                orderBy: {
                  createdAt: "asc",
                },
              },
            },
          },
        },
      },
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
  await checkAchievements(userProfileId);

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
