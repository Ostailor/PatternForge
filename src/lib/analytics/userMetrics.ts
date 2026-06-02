import "server-only";

import { calculateCurrentStreak } from "@/lib/gamification";
import { getTotalXP } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import { toRetentionScore } from "@/lib/review/queueUtils";
import type { ReviewRating } from "@/lib/review/types";
import type { Attempt, Confidence, SolvedStatus } from "@/lib/types";

import {
  getMostConfusedPatternPair,
  getPatternConfusions,
} from "./confusionMetrics";
import {
  getPatternMetrics,
  getStrongestPatternMetric,
  getWeakestPatternMetric,
} from "./patternMetrics";
import type { UserLearningMetrics } from "./types";

type DbAttemptForUserMetrics = Awaited<
  ReturnType<typeof loadUserMetricActivity>
>["attempts"][number];

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function toSolvedStatus(solvedStatus: DbAttemptForUserMetrics["solvedStatus"]): SolvedStatus {
  switch (solvedStatus) {
    case "Solved":
      return "Solved";
    case "PartiallySolved":
      return "Partially Solved";
    case "NotSolved":
      return "Not Solved";
  }
}

function toAnalyticsAttempt(attempt: DbAttemptForUserMetrics): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: Math.min(Math.max(attempt.confidence, 1), 5) as Confidence,
    reflection: attempt.reflection,
    createdAt: attempt.createdAt.toISOString(),
  };
}

async function loadUserMetricActivity(userProfileId: string) {
  const scopedUserProfileId = userProfileId.trim();

  if (!scopedUserProfileId) {
    return {
      attempts: [],
      reviewLogs: [],
      battles: [],
    };
  }

  const [attempts, reviewLogs, battles] = await Promise.all([
    getPrisma().attempt.findMany({
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
        reflection: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    getPrisma().reviewLog.findMany({
      where: { userProfileId: scopedUserProfileId },
      select: {
        itemType: true,
        rating: true,
        reviewedAt: true,
      },
      orderBy: { reviewedAt: "asc" },
    }),
    getPrisma().battle.findMany({
      where: {
        userProfileId: scopedUserProfileId,
        status: "Completed",
      },
      select: {
        result: true,
      },
    }),
  ]);

  return { attempts, reviewLogs, battles };
}

export async function getUserLearningMetrics(
  userProfileId: string,
): Promise<UserLearningMetrics> {
  const scopedUserProfileId = userProfileId.trim();
  const [patternMetrics, confusions, activity, totalXP] = await Promise.all([
    getPatternMetrics(scopedUserProfileId),
    getPatternConfusions(scopedUserProfileId),
    loadUserMetricActivity(scopedUserProfileId),
    scopedUserProfileId ? getTotalXP(scopedUserProfileId) : 0,
  ]);
  const attempts = activity.attempts.map(toAnalyticsAttempt);
  const reviewRatings = activity.reviewLogs.map(
    (reviewLog) => reviewLog.rating as ReviewRating,
  );
  const battleVictoryCount = activity.battles.filter(
    (battle) => battle.result === "Victory",
  ).length;

  return {
    totalAttempts: attempts.length,
    totalSolved: attempts.filter((attempt) => attempt.solvedStatus === "Solved")
      .length,
    overallRecognitionAccuracy: percentage(
      attempts.filter((attempt) => attempt.wasPatternCorrect).length,
      attempts.length,
    ),
    overallRetentionScore: toRetentionScore(reviewRatings),
    totalReviews: activity.reviewLogs.length,
    totalMistakes: patternMetrics.reduce(
      (total, patternMetric) => total + patternMetric.mistakeCount,
      0,
    ),
    totalFlashcards: patternMetrics.reduce(
      (total, patternMetric) => total + patternMetric.flashcardCount,
      0,
    ),
    battleWinRate: percentage(battleVictoryCount, activity.battles.length),
    currentStreak: calculateCurrentStreak(
      attempts,
      activity.reviewLogs.map((reviewLog) => ({
        itemType: reviewLog.itemType,
        rating: reviewLog.rating as ReviewRating,
        reviewedAt: reviewLog.reviewedAt,
      })),
    ),
    totalXP,
    strongestPattern: getStrongestPatternMetric(patternMetrics),
    weakestPattern: getWeakestPatternMetric(patternMetrics),
    mostConfusedPatternPair: getMostConfusedPatternPair(confusions),
  };
}
