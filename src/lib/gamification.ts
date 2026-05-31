import { patterns } from "@/data/patterns";
import { calculateMasteryScore } from "@/lib/mastery";
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

export function calculateAttemptXp(attempt: Attempt): number {
  return (
    5 +
    (attempt.wasPatternCorrect ? 10 : 0) +
    (attempt.solvedStatus === "Solved" ? 20 : 0) +
    (attempt.solvedStatus === "Partially Solved" ? 10 : 0) +
    (attempt.reflection.trim().length > 50 ? 5 : 0)
  );
}

function toLocalDateKey(createdAt: string): string | undefined {
  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return createdAt.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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

export function calculateCurrentStreak(attempts: Attempt[]): number {
  const practiceDates = getUniquePracticeDates(attempts);

  if (practiceDates.length === 0) {
    return 0;
  }

  const dateSet = new Set(practiceDates);
  let streak = 1;
  let cursor = practiceDates.at(-1) as string;

  while (dateSet.has(addDays(cursor, -1))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
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
): GamificationStats {
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

  return {
    xp: attempts.reduce((total, attempt) => total + calculateAttemptXp(attempt), 0),
    totalAttempts: attempts.length,
    problemsAttempted: attemptedProblemIds.size,
    problemsSolved: solvedProblemIds.size,
    recognitionAccuracy:
      attempts.length === 0 ? 0 : Math.round((recognized / attempts.length) * 100),
    currentStreak: calculateCurrentStreak(attempts),
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
