import { problems } from "@/data/problems";
import type {
  Attempt,
  ForgeSessionSummary,
  MasteryLevel,
  PatternProgress,
  PatternStats,
  UserProgress,
} from "./types";

export function calculateMasteryScore(attempts: Attempt[]): number {
  if (attempts.length === 0) {
    return 0;
  }

  const recognitionCorrect = attempts.filter(
    (attempt) => attempt.wasPatternCorrect,
  ).length;
  const solvedCount = attempts.filter(
    (attempt) => attempt.solvedStatus === "Solved",
  ).length;
  const recognitionScore = recognitionCorrect / attempts.length;
  const solveScore = solvedCount / attempts.length;

  return Math.round((recognitionScore * 0.6 + solveScore * 0.4) * 100);
}

export function getMasteryLevel(masteryScore: number): MasteryLevel {
  if (masteryScore >= 91) {
    return "Mastered";
  }

  if (masteryScore >= 76) {
    return "Sharp";
  }

  if (masteryScore >= 51) {
    return "Forging";
  }

  if (masteryScore >= 26) {
    return "Apprentice";
  }

  if (masteryScore >= 1) {
    return "Warming Up";
  }

  return "Not Started";
}

export function calculateMasteryLevel(stats: PatternStats): MasteryLevel {
  return getMasteryLevel(getPatternProgressPercent(stats));
}

export function getPatternStats(
  patternId: string,
  progress: UserProgress,
): PatternStats {
  const patternProblems = problems.filter(
    (problem) =>
      problem.primaryPatternId === patternId ||
      problem.secondaryPatternIds.includes(patternId),
  );

  return patternProblems.reduce<PatternStats>(
    (stats, problem) => {
      const attempt = progress.attempts[problem.id];

      if (!attempt) {
        return stats;
      }

      return {
        attempted: stats.attempted + 1,
        solved: stats.solved + (attempt.solvedStatus === "Solved" ? 1 : 0),
        recognized:
          stats.recognized +
          (attempt.correctPatternId === patternId && attempt.wasPatternCorrect
            ? 1
            : 0),
      };
    },
    { attempted: 0, solved: 0, recognized: 0 },
  );
}

export function getPatternProgressPercent(stats: PatternStats): number {
  if (stats.attempted === 0) {
    return 0;
  }

  const recognitionScore = stats.recognized / stats.attempted;
  const solveScore = stats.solved / stats.attempted;

  return Math.round((recognitionScore * 0.6 + solveScore * 0.4) * 100);
}

export function getPatternProgress(
  patternId: string,
  progress: UserProgress,
): PatternProgress {
  const attempts = (progress.attemptLog ?? Object.values(progress.attempts)).filter(
    (attempt) => attempt.correctPatternId === patternId,
  );
  const recognitionCorrect = attempts.filter(
    (attempt) => attempt.wasPatternCorrect,
  ).length;
  const solvedCount = attempts.filter(
    (attempt) => attempt.solvedStatus === "Solved",
  ).length;
  const lastPracticedAt = attempts
    .map((attempt) => attempt.createdAt)
    .sort()
    .at(-1);

  return {
    patternId,
    recognitionCorrect,
    recognitionAttempts: attempts.length,
    solvedCount,
    attemptedCount: attempts.length,
    masteryScore: calculateMasteryScore(attempts),
    lastPracticedAt,
  };
}

export function getOverallMasteryScore(progress: UserProgress): number {
  return calculateMasteryScore(
    progress.attemptLog ?? Object.values(progress.attempts),
  );
}

export function getProblemCountForPattern(patternId: string): number {
  return problems.filter(
    (problem) =>
      problem.primaryPatternId === patternId ||
      problem.secondaryPatternIds.includes(patternId),
  ).length;
}

export function summarizeSession(
  attempts: Attempt[],
): Pick<ForgeSessionSummary, "attempted" | "solved" | "averageConfidence"> {
  const attempted = attempts.length;
  const solved = attempts.filter(
    (attempt) => attempt.solvedStatus === "Solved",
  ).length;
  const confidenceTotal = attempts.reduce(
    (total, attempt) => total + attempt.confidence,
    0,
  );

  return {
    attempted,
    solved,
    averageConfidence: attempted === 0 ? 0 : confidenceTotal / attempted,
  };
}
