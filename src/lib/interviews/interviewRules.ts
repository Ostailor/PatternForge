import type { Difficulty } from "@/generated/prisma/enums";
import { getDifficultyOrderForReadiness } from "@/lib/interviews/scoring";

export const DEFAULT_RECENT_ATTEMPT_DAYS = 14;
export const SINGLE_PROBLEM_MIN_MINUTES = 30;
export const SINGLE_PROBLEM_MAX_MINUTES = 45;
export const DEFAULT_SINGLE_PROBLEM_MINUTES = 40;
export const DEFAULT_FOCUSED_PATTERN_MINUTES = 60;
export const DEFAULT_MIXED_INTERVIEW_MINUTES = 60;
export const DEFAULT_WEAKNESS_REPAIR_MINUTES = 60;

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export type InterviewProblemCandidate = {
  id: string;
  title: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  primaryPatternId: string;
  secondaryPatternIds: string[];
};

export function clampDuration(
  value: number | undefined,
  defaultValue: number,
  bounds?: { min: number; max: number },
): number {
  if (!Number.isFinite(value)) {
    return defaultValue;
  }

  const rounded = Math.round(value as number);

  if (!bounds) {
    return Math.max(1, rounded);
  }

  return Math.max(bounds.min, Math.min(bounds.max, rounded));
}

export function getRecentAttemptCutoff(
  now: Date,
  recentAttemptDays = DEFAULT_RECENT_ATTEMPT_DAYS,
): Date {
  return new Date(now.getTime() - Math.max(0, recentAttemptDays) * DAY_IN_MS);
}

export function getInterviewDifficultyOrder(
  readinessScore: number,
  explicitTarget?: Difficulty,
): Difficulty[] {
  return getDifficultyOrderForReadiness(readinessScore, explicitTarget);
}

function difficultyRank(
  difficulty: Difficulty,
  difficultyOrder: Difficulty[],
): number {
  const rank = difficultyOrder.indexOf(difficulty);

  return rank === -1 ? difficultyOrder.length : rank;
}

export function sortInterviewProblems(
  problems: InterviewProblemCandidate[],
  options: {
    difficultyOrder: Difficulty[];
    recentProblemIds?: Set<string>;
    usedProblemIds?: Set<string>;
  },
): InterviewProblemCandidate[] {
  const recentProblemIds = options.recentProblemIds ?? new Set<string>();
  const usedProblemIds = options.usedProblemIds ?? new Set<string>();

  return problems.slice().sort((a, b) => {
    const usedDelta =
      Number(usedProblemIds.has(a.id)) - Number(usedProblemIds.has(b.id));
    const recentDelta =
      Number(recentProblemIds.has(a.id)) - Number(recentProblemIds.has(b.id));

    return (
      usedDelta ||
      recentDelta ||
      difficultyRank(a.difficulty, options.difficultyOrder) -
        difficultyRank(b.difficulty, options.difficultyOrder) ||
      a.estimatedMinutes - b.estimatedMinutes ||
      a.title.localeCompare(b.title)
    );
  });
}

export function pickInterviewProblem(
  problems: InterviewProblemCandidate[],
  options: {
    difficultyOrder: Difficulty[];
    recentProblemIds?: Set<string>;
    usedProblemIds?: Set<string>;
    patternId?: string;
    includeSecondaryPatterns?: boolean;
  },
): InterviewProblemCandidate | null {
  const usedProblemIds = options.usedProblemIds ?? new Set<string>();
  const patternFiltered = options.patternId
    ? problems.filter(
        (problem) =>
          problem.primaryPatternId === options.patternId ||
          (options.includeSecondaryPatterns &&
            problem.secondaryPatternIds.includes(options.patternId as string)),
      )
    : problems;
  const sorted = sortInterviewProblems(patternFiltered, {
    difficultyOrder: options.difficultyOrder,
    recentProblemIds: options.recentProblemIds,
    usedProblemIds,
  });

  return sorted.find((problem) => !usedProblemIds.has(problem.id)) ?? sorted[0] ?? null;
}

