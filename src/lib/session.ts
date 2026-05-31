import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { calculateMasteryScore, summarizeSession } from "@/lib/mastery";
import { getAttempts } from "@/lib/progress";
import type { Attempt, ForgeSessionSummary, Pattern, Problem } from "./types";

export type ForgeProblemType = "Warm-up" | "Main Forge" | "Mixed Review";

export type DailyForgeProblem = {
  type: ForgeProblemType;
  problem: Problem;
};

export type DailyForgeSession = {
  goal: string;
  recommendedPattern: Pattern;
  problems: DailyForgeProblem[];
  estimatedTotalMinutes: number;
};

const DEFAULT_PATTERN_ID = "arrays-hashing";
const FIRST_RUN_PROBLEM_IDS = [
  "two-sum",
  "contains-duplicate",
  "valid-palindrome",
];

const difficultyRank: Record<Problem["difficulty"], number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

function getPatternOrDefault(patternId = DEFAULT_PATTERN_ID): Pattern {
  return (
    patterns.find((pattern) => pattern.id === patternId) ??
    patterns.find((pattern) => pattern.id === DEFAULT_PATTERN_ID) ??
    patterns[0]
  );
}

function getAttemptedProblemIds(attempts: Attempt[]) {
  return new Set(attempts.map((attempt) => attempt.problemId));
}

function findProblem(problemId: string): Problem {
  return (problems.find((problem) => problem.id === problemId) ??
    problems[0]) as Problem;
}

function sortForSession(problemList: Problem[], attempts: Attempt[]) {
  const attemptedProblemIds = getAttemptedProblemIds(attempts);

  return problemList.slice().sort((a, b) => {
    const attemptedDelta =
      Number(attemptedProblemIds.has(a.id)) - Number(attemptedProblemIds.has(b.id));

    return (
      attemptedDelta ||
      difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
      a.estimatedMinutes - b.estimatedMinutes ||
      a.title.localeCompare(b.title)
    );
  });
}

export function getProblemsForPattern(patternId: string): Problem[] {
  return problems.filter((problem) => problem.primaryPatternId === patternId);
}

export function getWeakestPattern(attempts: Attempt[] = getAttempts()): Pattern {
  if (attempts.length === 0) {
    return getPatternOrDefault();
  }

  return patterns
    .map((pattern) => {
      const patternAttempts = attempts.filter(
        (attempt) => attempt.correctPatternId === pattern.id,
      );

      return {
        pattern,
        score: calculateMasteryScore(patternAttempts),
        attempts: patternAttempts.length,
      };
    })
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.attempts - b.attempts ||
        a.pattern.levelOrder - b.pattern.levelOrder,
    )[0].pattern;
}

export function getMixedReviewProblem(
  excludedPatternId: string,
  attempts: Attempt[] = getAttempts(),
): Problem {
  const mixedPool = problems.filter(
    (problem) => problem.primaryPatternId !== excludedPatternId,
  );

  return sortForSession(mixedPool, attempts)[0] ?? problems[0];
}

export function generateDailySession(
  attempts: Attempt[] = getAttempts(),
  focusPatternId?: string,
): DailyForgeSession {
  const hasAttempts = attempts.length > 0;
  const recommendedPattern = focusPatternId
    ? getPatternOrDefault(focusPatternId)
    : hasAttempts
      ? getWeakestPattern(attempts)
      : getPatternOrDefault();

  if (!hasAttempts && !focusPatternId) {
    const firstRunProblems = FIRST_RUN_PROBLEM_IDS.map((problemId) =>
      findProblem(problemId),
    );
    const [warmUp, mainForge, mixedReview] = firstRunProblems;
    const sessionProblems: DailyForgeProblem[] = [
      { type: "Warm-up", problem: warmUp },
      { type: "Main Forge", problem: mainForge },
      { type: "Mixed Review", problem: mixedReview },
    ];

    return {
      goal: "Start with fast lookup reps, then finish with one different recognition cue.",
      recommendedPattern,
      problems: sessionProblems,
      estimatedTotalMinutes: sessionProblems.reduce(
        (total, item) => total + item.problem.estimatedMinutes,
        0,
      ),
    };
  }

  const focusProblems = sortForSession(
    getProblemsForPattern(recommendedPattern.id),
    attempts,
  );
  const warmUp = focusProblems[0] ?? problems[0];
  const mainForge =
    focusProblems.find((problem) => problem.id !== warmUp.id) ?? warmUp;
  const mixedReview = getMixedReviewProblem(recommendedPattern.id, attempts);
  const sessionProblems: DailyForgeProblem[] = [
    { type: "Warm-up", problem: warmUp },
    { type: "Main Forge", problem: mainForge },
    { type: "Mixed Review", problem: mixedReview },
  ];

  return {
    goal: "Sharpen a weak recognition lane, then cross-check it against a different problem shape.",
    recommendedPattern,
    problems: sessionProblems,
    estimatedTotalMinutes: sessionProblems.reduce(
      (total, item) => total + item.problem.estimatedMinutes,
      0,
    ),
  };
}

export function getDailyForgeProblems(): Problem[] {
  return generateDailySession().problems.map((item) => item.problem);
}

export function createSessionSummary(
  attempts: Attempt[],
  completedAt = new Date().toISOString(),
): ForgeSessionSummary {
  return {
    id: `session-${completedAt}`,
    completedAt,
    ...summarizeSession(attempts),
  };
}
