import "server-only";

import { calculateMasteryScore } from "@/lib/mastery";
import { getPrisma } from "@/lib/prisma";
import { getRatingValue, toRetentionScore } from "@/lib/review/queueUtils";
import type { ReviewRating } from "@/lib/review/types";
import type { Attempt, Confidence, SolvedStatus } from "@/lib/types";

import type { PatternMetric, PatternSummary } from "./types";

type DbAttemptForMetrics = Awaited<ReturnType<typeof loadPatternMetricData>>["attempts"][number];
type DbAIReviewForMetrics = Awaited<
  ReturnType<typeof loadPatternMetricData>
>["aiReviews"][number];
type DbReviewLogForMetrics = Awaited<
  ReturnType<typeof loadPatternMetricData>
>["reviewLogs"][number];
type DbBattleForMetrics = Awaited<ReturnType<typeof loadPatternMetricData>>["battles"][number];

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function safeUserProfileId(userProfileId: string): string {
  return userProfileId.trim();
}

function roundMetric(value: number): number {
  return Math.round(value);
}

function average(values: number[]): number | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));

  if (finiteValues.length === 0) {
    return null;
  }

  return (
    finiteValues.reduce((total, value) => total + value, 0) / finiteValues.length
  );
}

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : roundMetric((count / total) * 100);
}

function normalizeAIScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score <= 10 ? score * 10 : score));
}

function toSolvedStatus(solvedStatus: DbAttemptForMetrics["solvedStatus"]): SolvedStatus {
  switch (solvedStatus) {
    case "Solved":
      return "Solved";
    case "PartiallySolved":
      return "Partially Solved";
    case "NotSolved":
      return "Not Solved";
  }
}

function toAnalyticsAttempt(attempt: DbAttemptForMetrics): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: Math.min(Math.max(attempt.confidence, 1), 5) as Confidence,
    reflection: "",
    createdAt: attempt.createdAt.toISOString(),
  };
}

function getReviewPatternId(reviewLog: DbReviewLogForMetrics): string | null {
  return reviewLog.flashcard?.patternId ?? reviewLog.mistake?.patternId ?? null;
}

function getDaysSincePractice(lastPracticedAt: Date | null, now: Date): number | null {
  if (!lastPracticedAt) {
    return null;
  }

  return Math.max(
    0,
    Math.floor((now.getTime() - lastPracticedAt.getTime()) / DAY_IN_MS),
  );
}

function getAIReviewAverage(review: DbAIReviewForMetrics): number {
  return roundMetric(
    average([
      normalizeAIScore(review.patternScore),
      normalizeAIScore(review.implementationScore),
      normalizeAIScore(review.complexityScore),
      normalizeAIScore(review.explanationScore),
    ]) ?? 0,
  );
}

function summarizePattern(patternMetric: PatternMetric): PatternSummary {
  return {
    patternId: patternMetric.patternId,
    patternName: patternMetric.patternName,
    masteryScore: patternMetric.masteryScore,
  };
}

function hasPatternSignal(patternMetric: PatternMetric): boolean {
  return (
    patternMetric.attemptsCount > 0 ||
    patternMetric.mistakeCount > 0 ||
    patternMetric.flashcardCount > 0 ||
    patternMetric.reviewCount > 0 ||
    patternMetric.battleCount > 0
  );
}

async function loadPatternMetricData(userProfileId: string) {
  const scopedUserProfileId = safeUserProfileId(userProfileId);
  const prisma = getPrisma();

  if (!scopedUserProfileId) {
    return {
      patterns: [],
      attempts: [],
      aiReviews: [],
      mistakes: [],
      flashcards: [],
      reviewLogs: [],
      battles: [],
    };
  }

  const [patterns, attempts, aiReviews, mistakes, flashcards, reviewLogs, battles] =
    await Promise.all([
      prisma.pattern.findMany({
        select: {
          id: true,
          name: true,
          levelOrder: true,
        },
        orderBy: { levelOrder: "asc" },
      }),
      prisma.attempt.findMany({
        where: { userProfileId: scopedUserProfileId },
        select: {
          id: true,
          problemId: true,
          selectedPatternId: true,
          correctPatternId: true,
          wasPatternCorrect: true,
          solvedStatus: true,
          timeSpentMinutes: true,
          confidence: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.aIReview.findMany({
        where: { userProfileId: scopedUserProfileId },
        select: {
          patternId: true,
          patternScore: true,
          implementationScore: true,
          complexityScore: true,
          explanationScore: true,
        },
      }),
      prisma.mistake.findMany({
        where: { userProfileId: scopedUserProfileId },
        select: {
          patternId: true,
          lapses: true,
        },
      }),
      prisma.flashcard.findMany({
        where: { userProfileId: scopedUserProfileId },
        select: {
          patternId: true,
          lapses: true,
        },
      }),
      prisma.reviewLog.findMany({
        where: { userProfileId: scopedUserProfileId },
        select: {
          rating: true,
          flashcard: {
            select: {
              patternId: true,
            },
          },
          mistake: {
            select: {
              patternId: true,
            },
          },
        },
      }),
      prisma.battle.findMany({
        where: {
          userProfileId: scopedUserProfileId,
          status: "Completed",
        },
        select: {
          id: true,
          result: true,
          targetPatternId: true,
          rounds: {
            select: {
              expectedPatternId: true,
            },
          },
        },
      }),
    ]);

  return { patterns, attempts, aiReviews, mistakes, flashcards, reviewLogs, battles };
}

function getBattlePatternIds(battle: DbBattleForMetrics): string[] {
  return Array.from(
    new Set([
      ...(battle.targetPatternId ? [battle.targetPatternId] : []),
      ...battle.rounds.map((round) => round.expectedPatternId),
    ]),
  );
}

export function getStrongestPatternMetric(
  patternMetrics: PatternMetric[],
): PatternSummary | null {
  return (
    patternMetrics
      .filter(hasPatternSignal)
      .slice()
      .sort(
        (a, b) =>
          b.masteryScore - a.masteryScore ||
          b.attemptsCount - a.attemptsCount ||
          a.patternName.localeCompare(b.patternName),
      )
      .map(summarizePattern)[0] ?? null
  );
}

export function getWeakestPatternMetric(
  patternMetrics: PatternMetric[],
): PatternSummary | null {
  return (
    patternMetrics
      .filter(hasPatternSignal)
      .slice()
      .sort(
        (a, b) =>
          a.masteryScore - b.masteryScore ||
          b.attemptsCount - a.attemptsCount ||
          a.patternName.localeCompare(b.patternName),
      )
      .map(summarizePattern)[0] ?? null
  );
}

export async function getPatternMetrics(
  userProfileId: string,
  now = new Date(),
): Promise<PatternMetric[]> {
  const { patterns, attempts, aiReviews, mistakes, flashcards, reviewLogs, battles } =
    await loadPatternMetricData(userProfileId);

  return patterns.map((pattern) => {
    const patternAttempts = attempts.filter(
      (attempt) => attempt.correctPatternId === pattern.id,
    );
    const solvedCount = patternAttempts.filter(
      (attempt) => attempt.solvedStatus === "Solved",
    ).length;
    const partiallySolvedCount = patternAttempts.filter(
      (attempt) => attempt.solvedStatus === "PartiallySolved",
    ).length;
    const notSolvedCount = patternAttempts.filter(
      (attempt) => attempt.solvedStatus === "NotSolved",
    ).length;
    const recognitionCorrect = patternAttempts.filter(
      (attempt) => attempt.wasPatternCorrect,
    ).length;
    const aiScores = aiReviews
      .filter((review) => review.patternId === pattern.id)
      .map(getAIReviewAverage);
    const patternMistakes = mistakes.filter(
      (mistake) => mistake.patternId === pattern.id,
    );
    const patternFlashcards = flashcards.filter(
      (flashcard) => flashcard.patternId === pattern.id,
    );
    const patternReviewRatings = reviewLogs
      .filter((reviewLog) => getReviewPatternId(reviewLog) === pattern.id)
      .map((reviewLog) => reviewLog.rating as ReviewRating);
    const patternBattleResults = battles.filter((battle) =>
      getBattlePatternIds(battle).includes(pattern.id),
    );
    const lastPracticedAt =
      patternAttempts
        .map((attempt) => attempt.createdAt)
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
    const reviewRatingAverage = average(
      patternReviewRatings.map(getRatingValue),
    );

    return {
      patternId: pattern.id,
      patternName: pattern.name,
      attemptsCount: patternAttempts.length,
      solvedCount,
      partiallySolvedCount,
      notSolvedCount,
      solveRate: percentage(solvedCount, patternAttempts.length),
      recognitionAttempts: patternAttempts.length,
      recognitionCorrect,
      recognitionAccuracy: percentage(recognitionCorrect, patternAttempts.length),
      averageConfidence:
        average(patternAttempts.map((attempt) => attempt.confidence)) ?? null,
      averageAIScore: average(aiScores),
      mistakeCount: patternMistakes.length,
      flashcardCount: patternFlashcards.length,
      reviewCount: patternReviewRatings.length,
      reviewRatingAverage:
        reviewRatingAverage === null ? null : roundMetric(reviewRatingAverage),
      lapseCount:
        patternMistakes.reduce((total, mistake) => total + mistake.lapses, 0) +
        patternFlashcards.reduce(
          (total, flashcard) => total + flashcard.lapses,
          0,
        ),
      retentionScore: toRetentionScore(patternReviewRatings),
      battleCount: patternBattleResults.length,
      battleVictoryCount: patternBattleResults.filter(
        (battle) => battle.result === "Victory",
      ).length,
      lastPracticedAt: lastPracticedAt?.toISOString() ?? null,
      daysSincePractice: getDaysSincePractice(lastPracticedAt, now),
      masteryScore: calculateMasteryScore({
        attempts: patternAttempts.map(toAnalyticsAttempt),
        explanationScores: aiReviews
          .filter((review) => review.patternId === pattern.id)
          .map((review) => review.explanationScore),
        retentionRatings: patternReviewRatings,
      }),
    };
  });
}
