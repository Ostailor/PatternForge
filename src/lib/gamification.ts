import { patterns } from "@/data/patterns";
import { calculateMasteryScore } from "@/lib/mastery";
import {
  calculateConsecutiveDayStreak,
  toLocalDateKey,
} from "@/lib/memory-streak";
import type { ReviewItemType, ReviewRating } from "@/lib/review/types";
import type { Attempt, Pattern } from "./types";

export type PatternStanding = {
  pattern: Pattern;
  masteryScore: number;
  attempts: number;
};

export type GamificationStats = {
  xp: number;
  totalAttempts: number;
  problemsAttempted: number;
  problemsSolved: number;
  recognitionAccuracy: number;
  currentStreak: number;
  masteredPatternsCount: number;
  bestPattern?: PatternStanding;
  weakestPattern?: PatternStanding;
};

export type ReviewXpActivity = {
  itemType: ReviewItemType;
  rating: ReviewRating;
  reviewedAt: Date | string;
  mistakeHadPriorLapse?: boolean;
};

export type GamificationStatsOptions = {
  reviewActivities?: ReviewXpActivity[];
  clearedDueReviewsToday?: boolean;
};

export function calculateAttemptXp(attempt: Attempt): number {
  return (
    5 +
    (attempt.wasPatternCorrect ? 10 : 0) +
    (attempt.solvedStatus === "Solved" ? 20 : 0) +
    (attempt.solvedStatus === "Partially Solved" ? 10 : 0) +
    (attempt.reflection.trim().length > 50 ? 5 : 0)
  );
}

export function calculateReviewXp(activity: ReviewXpActivity): number {
  return (
    (activity.itemType === "Flashcard" ? 5 : 0) +
    (activity.itemType === "Mistake" ? 5 : 0) +
    (activity.rating === "Good" ? 5 : 0) +
    (activity.rating === "Easy" ? 10 : 0)
  );
}

export function getUniquePracticeDates(attempts: Attempt[]): string[] {
  return Array.from(
    new Set(
      attempts
        .map((attempt) => toLocalDateKey(attempt.createdAt))
        .filter((dateKey): dateKey is string => Boolean(dateKey)),
    ),
  ).sort();
}

export function calculateCurrentStreak(
  attempts: Attempt[],
  reviewActivities: ReviewXpActivity[] = [],
): number {
  const activityDates = [
    ...getUniquePracticeDates(attempts),
    ...reviewActivities
      .map((activity) => toLocalDateKey(activity.reviewedAt))
      .filter((dateKey): dateKey is string => Boolean(dateKey)),
  ];

  return calculateConsecutiveDayStreak(activityDates);
}

function getPatternStandings(attempts: Attempt[]): PatternStanding[] {
  return patterns.map((pattern) => {
    const patternAttempts = attempts.filter(
      (attempt) => attempt.correctPatternId === pattern.id,
    );

    return {
      pattern,
      masteryScore: calculateMasteryScore(patternAttempts),
      attempts: patternAttempts.length,
    };
  });
}

export function getGamificationStats(
  attempts: Attempt[],
  options: GamificationStatsOptions = {},
): GamificationStats {
  const reviewActivities = options.reviewActivities ?? [];
  const attemptedProblemIds = new Set(
    attempts.map((attempt) => attempt.problemId),
  );
  const solvedProblemIds = new Set(
    attempts
      .filter((attempt) => attempt.solvedStatus === "Solved")
      .map((attempt) => attempt.problemId),
  );
  const recognized = attempts.filter(
    (attempt) => attempt.wasPatternCorrect,
  ).length;
  const attemptedPatternStandings = getPatternStandings(attempts).filter(
    (standing) => standing.attempts > 0,
  );
  const attemptXp = attempts.reduce(
    (total, attempt) => total + calculateAttemptXp(attempt),
    0,
  );
  const reviewXp = reviewActivities.reduce(
    (total, activity) => total + calculateReviewXp(activity),
    0,
  );

  return {
    xp: attemptXp + reviewXp,
    totalAttempts: attempts.length,
    problemsAttempted: attemptedProblemIds.size,
    problemsSolved: solvedProblemIds.size,
    recognitionAccuracy:
      attempts.length === 0 ? 0 : Math.round((recognized / attempts.length) * 100),
    currentStreak: calculateCurrentStreak(attempts, reviewActivities),
    masteredPatternsCount: getPatternStandings(attempts).filter(
      (standing) => standing.masteryScore >= 91,
    ).length,
    bestPattern: attemptedPatternStandings
      .slice()
      .sort(
        (a, b) =>
          b.masteryScore - a.masteryScore ||
          b.attempts - a.attempts ||
          a.pattern.levelOrder - b.pattern.levelOrder,
      )[0],
    weakestPattern: attemptedPatternStandings
      .slice()
      .sort(
        (a, b) =>
          a.masteryScore - b.masteryScore ||
          b.attempts - a.attempts ||
          a.pattern.levelOrder - b.pattern.levelOrder,
      )[0],
  };
}
