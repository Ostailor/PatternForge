import { problems } from "@/data/problems";
import type { ReviewRating } from "@/lib/review/types";
import type {
  Attempt,
  ForgeSessionSummary,
  MasteryLevel,
  PatternProgress,
  PatternStats,
  UserProgress,
} from "./types";

const RECOGNITION_WEIGHT = 0.35;
const SOLVE_WEIGHT = 0.25;
const EXPLANATION_WEIGHT = 0.15;
const RETENTION_WEIGHT = 0.2;
const CONFIDENCE_WEIGHT = 0.05;
const REDISTRIBUTION_BASE_WEIGHT = RECOGNITION_WEIGHT + SOLVE_WEIGHT;

export type MasteryScoreInput = {
  attempts: Attempt[];
  explanationScores?: number[];
  retentionRatings?: ReviewRating[];
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, score));
}

function normalizeAIReviewScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return score <= 10 ? clampScore(score * 10) : clampScore(score);
}

function average(scores: number[]): number | null {
  const validScores = scores.filter((score) => Number.isFinite(score));

  if (validScores.length === 0) {
    return null;
  }

  return (
    validScores.reduce((total, score) => total + score, 0) /
    validScores.length
  );
}

export function getReviewRatingScore(rating: ReviewRating): number {
  switch (rating) {
    case "Again":
      return 0;
    case "Hard":
      return 50;
    case "Good":
      return 85;
    case "Easy":
      return 100;
  }
}

export function calculateRetentionScore(
  retentionRatings: ReviewRating[] = [],
): number | null {
  const retentionScore = average(retentionRatings.map(getReviewRatingScore));

  return retentionScore === null ? null : Math.round(retentionScore);
}

export function calculateExplanationScore(
  explanationScores: number[] = [],
): number | null {
  const explanationScore = average(explanationScores.map(normalizeAIReviewScore));

  return explanationScore === null ? null : Math.round(explanationScore);
}

export function calculateConfidenceScore(attempts: Attempt[]): number {
  const confidenceScore = average(
    attempts.map((attempt) => ((attempt.confidence - 1) / 4) * 100),
  );

  return confidenceScore === null ? 0 : Math.round(clampScore(confidenceScore));
}

export function calculateMasteryScore(
  input: Attempt[] | MasteryScoreInput,
): number {
  const attempts = Array.isArray(input) ? input : input.attempts;

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
  const explanationScore = Array.isArray(input)
    ? null
    : calculateExplanationScore(input.explanationScores);
  const retentionScore = Array.isArray(input)
    ? null
    : calculateRetentionScore(input.retentionRatings);
  const confidenceScore = calculateConfidenceScore(attempts);

  let recognitionWeight = RECOGNITION_WEIGHT;
  let solveWeight = SOLVE_WEIGHT;
  let explanationWeight = EXPLANATION_WEIGHT;
  let retentionWeight = RETENTION_WEIGHT;

  function redistributeToAttemptSignals(weight: number) {
    recognitionWeight +=
      weight * (RECOGNITION_WEIGHT / REDISTRIBUTION_BASE_WEIGHT);
    solveWeight += weight * (SOLVE_WEIGHT / REDISTRIBUTION_BASE_WEIGHT);
  }

  if (explanationScore === null) {
    redistributeToAttemptSignals(explanationWeight);
    explanationWeight = 0;
  }

  if (retentionScore === null) {
    redistributeToAttemptSignals(retentionWeight);
    retentionWeight = 0;
  }

  const weightedScore =
    recognitionScore * 100 * recognitionWeight +
    solveScore * 100 * solveWeight +
    (explanationScore ?? 0) * explanationWeight +
    (retentionScore ?? 0) * retentionWeight +
    confidenceScore * CONFIDENCE_WEIGHT;

  return Math.round(clampScore(weightedScore));
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

export function getMasteryLevelNumber(masteryScore: number): 0 | 1 | 2 | 3 | 4 | 5 {
  const level = getMasteryLevel(masteryScore);

  switch (level) {
    case "Mastered":
      return 5;
    case "Sharp":
      return 4;
    case "Forging":
      return 3;
    case "Apprentice":
      return 2;
    case "Warming Up":
      return 1;
    case "Not Started":
      return 0;
  }
}

export function isMasterTier(masteryScore: number): boolean {
  return masteryScore >= 76;
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

  return calculateMasteryScore(
    Array.from({ length: stats.attempted }, (_, index): Attempt => ({
      id: `stats-${index}`,
      problemId: `stats-${index}`,
      selectedPatternId: "",
      correctPatternId: "",
      wasPatternCorrect: index < stats.recognized,
      solvedStatus: index < stats.solved ? "Solved" : "Not Solved",
      timeSpentMinutes: 0,
      confidence: 3,
      reflection: "",
      createdAt: "",
    })),
  );
}

export function getPatternProgress(
  patternId: string,
  progress: UserProgress,
  masteryInput?: Omit<MasteryScoreInput, "attempts">,
): PatternProgress {
  const attempts = (
    progress.attemptLog ?? Object.values(progress.attempts)
  ).filter((attempt) => attempt.correctPatternId === patternId);
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

  const explanationScore = calculateExplanationScore(
    masteryInput?.explanationScores,
  );
  const retentionScore = calculateRetentionScore(masteryInput?.retentionRatings);

  return {
    patternId,
    recognitionCorrect,
    recognitionAttempts: attempts.length,
    solvedCount,
    attemptedCount: attempts.length,
    masteryScore: calculateMasteryScore({
      attempts,
      explanationScores: masteryInput?.explanationScores,
      retentionRatings: masteryInput?.retentionRatings,
    }),
    explanationScore,
    retentionScore,
    confidenceScore:
      attempts.length === 0 ? null : calculateConfidenceScore(attempts),
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
