import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import { calculateMasteryScore, summarizeSession } from "@/lib/mastery";
import { getAttempts } from "@/lib/progress";
import { calculatePatternWeaknessScores } from "@/lib/recommendations/weaknessScore";
import type { WeaknessPatternInput } from "@/lib/recommendations/types";
import type {
  Attempt,
  ForgeSessionSummary,
  Pattern,
  PatternProgress,
  Problem,
} from "./types";

export type ForgeStepType =
  | "Due Review Warmup"
  | "Recognition Drill"
  | "Focused Problem"
  | "Contrast Problem"
  | "Mixed Review"
  | "Boss Prep";

export type ForgeProblemType = ForgeStepType;

export type DailyForgeReviewStats = {
  dueFlashcardsCount?: number;
  dueMistakesCount?: number;
  totalDueCount?: number;
};

export type DailyForgeOptions = {
  patternProgressById?: Record<string, PatternProgress> | null;
  reviewStats?: DailyForgeReviewStats | null;
  now?: Date;
};

export type DailyForgeStep = {
  type: ForgeStepType;
  title: string;
  description: string;
  problem?: Problem;
  targetPatternId?: string;
  secondaryPatternId?: string;
  reviewCount?: number;
  href?: string;
  estimatedMinutes: number;
  revealsPattern: false;
};

export type DailyForgeProblem = {
  type: ForgeProblemType;
  problem: Problem;
  title: string;
  description: string;
  targetPatternId?: string;
  secondaryPatternId?: string;
  estimatedMinutes: number;
  revealsPattern: false;
};

export type DailyForgeSession = {
  goal: string;
  recommendedPattern: Pattern;
  steps: DailyForgeStep[];
  problems: DailyForgeProblem[];
  estimatedTotalMinutes: number;
};

const DEFAULT_PATTERN_ID = "arrays-hashing";
const BEGINNER_PATTERN_IDS = ["arrays-hashing", "two-pointers"];
const FIRST_RUN_PROBLEM_IDS = [
  "two-sum",
  "contains-duplicate",
  "valid-palindrome",
];
const RECENT_ATTEMPT_DAYS = 14;
const MAX_DAILY_STEPS = 5;

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

function getRecentlyAttemptedProblemIds(
  attempts: Attempt[],
  now: Date,
  days = RECENT_ATTEMPT_DAYS,
) {
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;

  return new Set(
    attempts
      .filter((attempt) => new Date(attempt.createdAt).getTime() >= cutoffMs)
      .map((attempt) => attempt.problemId),
  );
}

function findProblem(problemId: string): Problem {
  return (problems.find((problem) => problem.id === problemId) ??
    problems[0]) as Problem;
}

function sortForSession(
  problemList: Problem[],
  attempts: Attempt[],
  now = new Date(),
) {
  const attemptedProblemIds = getAttemptedProblemIds(attempts);
  const recentlyAttemptedProblemIds = getRecentlyAttemptedProblemIds(
    attempts,
    now,
  );

  return problemList.slice().sort((a, b) => {
    const recentDelta =
      Number(recentlyAttemptedProblemIds.has(a.id)) -
      Number(recentlyAttemptedProblemIds.has(b.id));
    const attemptedDelta =
      Number(attemptedProblemIds.has(a.id)) - Number(attemptedProblemIds.has(b.id));

    return (
      recentDelta ||
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

function getProblemsTouchingPattern(patternId: string): Problem[] {
  return problems.filter(
    (problem) =>
      problem.primaryPatternId === patternId ||
      problem.secondaryPatternIds.includes(patternId),
  );
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

function getWeakestPatternFromProgress(
  attempts: Attempt[],
  patternProgressById?: Record<string, PatternProgress> | null,
  now = new Date(),
): Pattern {
  const progressValues = Object.values(patternProgressById ?? {}).filter(
    (progress) => progress.attemptedCount > 0,
  );

  if (progressValues.length === 0) {
    return getWeakestPattern(attempts);
  }

  const [weakestScore] = calculatePatternWeaknessScores(
    buildWeaknessInputsFromProgress(progressValues, attempts, now),
  ).filter((score) => score.severity !== "Unstarted");

  if (weakestScore) {
    return getPatternOrDefault(weakestScore.patternId);
  }

  const [fallbackProgress] = progressValues.sort((a, b) => {
    const aPattern = getPatternOrDefault(a.patternId);
    const bPattern = getPatternOrDefault(b.patternId);

    return (
      a.masteryScore - b.masteryScore ||
      (a.retentionScore ?? 100) - (b.retentionScore ?? 100) ||
      aPattern.levelOrder - bPattern.levelOrder
    );
  });

  return getPatternOrDefault(fallbackProgress.patternId);
}

function getDaysSincePractice(
  lastPracticedAt: string | undefined,
  now: Date,
): number | null {
  if (!lastPracticedAt) {
    return null;
  }

  const elapsedMs = now.getTime() - new Date(lastPracticedAt).getTime();

  return Math.max(0, Math.floor(elapsedMs / (24 * 60 * 60 * 1000)));
}

function getSelectedIncorrectlyCounts(attempts: Attempt[]): Record<string, number> {
  return attempts.reduce<Record<string, number>>((counts, attempt) => {
    if (attempt.selectedPatternId === attempt.correctPatternId) {
      return counts;
    }

    counts[attempt.selectedPatternId] =
      (counts[attempt.selectedPatternId] ?? 0) + 1;

    return counts;
  }, {});
}

function buildWeaknessInputsFromProgress(
  progressValues: PatternProgress[],
  attempts: Attempt[],
  now: Date,
): WeaknessPatternInput[] {
  const selectedIncorrectlyCounts = getSelectedIncorrectlyCounts(attempts);

  return progressValues.map((progress) => {
    const recognitionAccuracy =
      progress.recognitionAttempts > 0
        ? Math.round(
            (progress.recognitionCorrect / progress.recognitionAttempts) * 100,
          )
        : 0;
    const solveRate =
      progress.attemptedCount > 0
        ? Math.round((progress.solvedCount / progress.attemptedCount) * 100)
        : 0;

    return {
      patternId: progress.patternId,
      masteryScore: progress.masteryScore,
      recognitionAccuracy,
      solveRate,
      retentionScore: progress.retentionScore ?? null,
      mistakeCount: 0,
      lapseCount: 0,
      battleCount: 0,
      battleVictoryCount: 0,
      daysSincePractice: getDaysSincePractice(progress.lastPracticedAt, now),
      attemptsCount: progress.attemptedCount,
      selectedIncorrectlyForOtherCount:
        selectedIncorrectlyCounts[progress.patternId] ?? 0,
    };
  });
}

function getReadyForBossPattern(
  patternProgressById?: Record<string, PatternProgress> | null,
): Pattern | null {
  const [readyProgress] = Object.values(patternProgressById ?? {})
    .filter(
      (progress) =>
        progress.attemptedCount > 0 &&
        progress.masteryScore >= 76 &&
        (progress.retentionScore ?? 0) >= 75,
    )
    .sort((a, b) => {
      const aPattern = getPatternOrDefault(a.patternId);
      const bPattern = getPatternOrDefault(b.patternId);

      return (
        b.masteryScore - a.masteryScore ||
        (b.retentionScore ?? 0) - (a.retentionScore ?? 0) ||
        aPattern.levelOrder - bPattern.levelOrder
      );
    });

  return readyProgress ? getPatternOrDefault(readyProgress.patternId) : null;
}

type ConfusionPair = {
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: string;
};

function getTopAttemptConfusion(attempts: Attempt[]): ConfusionPair | null {
  const confusionMap = attempts.reduce<Record<string, ConfusionPair>>(
    (byPair, attempt) => {
      if (attempt.selectedPatternId === attempt.correctPatternId) {
        return byPair;
      }

      const key = `${attempt.selectedPatternId}:${attempt.correctPatternId}`;
      const existing = byPair[key];

      if (!existing) {
        byPair[key] = {
          selectedPatternId: attempt.selectedPatternId,
          correctPatternId: attempt.correctPatternId,
          count: 1,
          lastSeenAt: attempt.createdAt,
        };
        return byPair;
      }

      byPair[key] = {
        ...existing,
        count: existing.count + 1,
        lastSeenAt:
          attempt.createdAt > existing.lastSeenAt
            ? attempt.createdAt
            : existing.lastSeenAt,
      };

      return byPair;
    },
    {},
  );

  const [topPair] = Object.values(confusionMap)
    .filter((pair) => pair.count >= 2)
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.lastSeenAt.localeCompare(a.lastSeenAt) ||
        a.correctPatternId.localeCompare(b.correctPatternId) ||
        a.selectedPatternId.localeCompare(b.selectedPatternId),
    );

  return topPair ?? null;
}

function pickProblemForPattern({
  patternId,
  attempts,
  usedProblemIds,
  now,
  difficulty,
  includeSecondary = false,
}: {
  patternId: string;
  attempts: Attempt[];
  usedProblemIds: Set<string>;
  now: Date;
  difficulty?: Problem["difficulty"];
  includeSecondary?: boolean;
}): Problem {
  const basePool = includeSecondary
    ? getProblemsTouchingPattern(patternId)
    : getProblemsForPattern(patternId);
  const difficultyPool = difficulty
    ? basePool.filter((problem) => problem.difficulty === difficulty)
    : basePool;
  const sortedPool = sortForSession(
    difficultyPool.length > 0 ? difficultyPool : basePool,
    attempts,
    now,
  );

  return (
    sortedPool.find((problem) => !usedProblemIds.has(problem.id)) ??
    sortedPool[0] ??
    problems.find((problem) => !usedProblemIds.has(problem.id)) ??
    problems[0]
  );
}

function pickMixedReviewProblem({
  excludedPatternIds,
  attempts,
  usedProblemIds,
  now,
  patternProgressById,
}: {
  excludedPatternIds: string[];
  attempts: Attempt[];
  usedProblemIds: Set<string>;
  now: Date;
  patternProgressById?: Record<string, PatternProgress> | null;
}): Problem {
  const masteredPatternIds = Object.values(patternProgressById ?? {})
    .filter(
      (progress) =>
        progress.attemptedCount > 0 &&
        progress.masteryScore >= 70 &&
        !excludedPatternIds.includes(progress.patternId),
    )
    .sort((a, b) => {
      const aLast = a.lastPracticedAt ?? "";
      const bLast = b.lastPracticedAt ?? "";

      return (
        aLast.localeCompare(bLast) ||
        b.masteryScore - a.masteryScore ||
        getPatternOrDefault(a.patternId).levelOrder -
          getPatternOrDefault(b.patternId).levelOrder
      );
    })
    .map((progress) => progress.patternId);

  for (const patternId of masteredPatternIds) {
    const problem = pickProblemForPattern({
      patternId,
      attempts,
      usedProblemIds,
      now,
    });

    if (!usedProblemIds.has(problem.id)) {
      return problem;
    }
  }

  const mixedPool = problems.filter(
    (problem) =>
      !excludedPatternIds.includes(problem.primaryPatternId) &&
      problem.secondaryPatternIds.every(
        (patternId) => !excludedPatternIds.includes(patternId),
      ),
  );
  const sortedPool = sortForSession(mixedPool, attempts, now);

  return (
    sortedPool.find((problem) => !usedProblemIds.has(problem.id)) ??
    sortedPool[0] ??
    getMixedReviewProblem(excludedPatternIds[0] ?? DEFAULT_PATTERN_ID, attempts)
  );
}

function getDueReviewCount(reviewStats?: DailyForgeReviewStats | null): number {
  const explicitTotal = reviewStats?.totalDueCount;

  if (typeof explicitTotal === "number") {
    return Math.max(0, explicitTotal);
  }

  return Math.max(
    0,
    (reviewStats?.dueFlashcardsCount ?? 0) +
      (reviewStats?.dueMistakesCount ?? 0),
  );
}

function makeProblemStep({
  type,
  problem,
  title,
  description,
  targetPatternId,
  secondaryPatternId,
}: {
  type: ForgeStepType;
  problem: Problem;
  title: string;
  description: string;
  targetPatternId?: string;
  secondaryPatternId?: string;
}): DailyForgeStep {
  return {
    type,
    title,
    description,
    problem,
    targetPatternId,
    secondaryPatternId,
    estimatedMinutes: problem.estimatedMinutes,
    revealsPattern: false,
  };
}

function toSessionProblems(steps: DailyForgeStep[]): DailyForgeProblem[] {
  return steps
    .filter(
      (step): step is DailyForgeStep & { problem: Problem } =>
        step.problem !== undefined,
    )
    .map((step) => ({
      type: step.type,
      problem: step.problem,
      title: step.title,
      description: step.description,
      targetPatternId: step.targetPatternId,
      secondaryPatternId: step.secondaryPatternId,
      estimatedMinutes: step.estimatedMinutes,
      revealsPattern: step.revealsPattern,
    }));
}

function createSessionFromSteps({
  goal,
  recommendedPattern,
  steps,
}: {
  goal: string;
  recommendedPattern: Pattern;
  steps: DailyForgeStep[];
}): DailyForgeSession {
  const trimmedSteps = steps.slice(0, MAX_DAILY_STEPS);

  return {
    goal,
    recommendedPattern,
    steps: trimmedSteps,
    problems: toSessionProblems(trimmedSteps),
    estimatedTotalMinutes: trimmedSteps.reduce(
      (total, step) => total + step.estimatedMinutes,
      0,
    ),
  };
}

export function generateDailySession(
  attempts: Attempt[] = getAttempts(),
  focusPatternId?: string,
  options: DailyForgeOptions = {},
): DailyForgeSession {
  const now = options.now ?? new Date();
  const hasAttempts = attempts.length > 0;
  const recommendedPattern = focusPatternId
    ? getPatternOrDefault(focusPatternId)
    : hasAttempts
      ? getWeakestPatternFromProgress(attempts, options.patternProgressById, now)
      : getPatternOrDefault();
  const usedProblemIds = new Set<string>();

  if (!hasAttempts && !focusPatternId) {
    const firstRunProblems = FIRST_RUN_PROBLEM_IDS.map((problemId) =>
      findProblem(problemId),
    );
    const [recognitionProblem, focusedProblem, mixedProblem] =
      firstRunProblems;
    const steps: DailyForgeStep[] = [
      makeProblemStep({
        type: "Recognition Drill",
        problem: recognitionProblem,
        title: "Recognition drill",
        description: "Identify the pattern from metadata before opening code.",
        targetPatternId: recognitionProblem.primaryPatternId,
      }),
      makeProblemStep({
        type: "Focused Problem",
        problem: focusedProblem,
        title: "Beginner focus rep",
        description: "Build a first baseline on core lookup mechanics.",
        targetPatternId: focusedProblem.primaryPatternId,
      }),
      makeProblemStep({
        type: "Mixed Review",
        problem: mixedProblem,
        title: "Starter contrast rep",
        description: "Compare the starter cue against a different beginner shape.",
        targetPatternId: mixedProblem.primaryPatternId,
      }),
    ];

    return createSessionFromSteps({
      goal: "Start with beginner-friendly recognition reps across two core problem shapes.",
      recommendedPattern,
      steps: steps.filter((step) =>
        BEGINNER_PATTERN_IDS.includes(step.problem?.primaryPatternId ?? ""),
      ),
    });
  }

  const steps: DailyForgeStep[] = [];
  const dueReviewCount = getDueReviewCount(options.reviewStats);

  if (dueReviewCount > 0) {
    steps.push({
      type: "Due Review Warmup",
      title: "Due review warmup",
      description: "Clear a few due flashcards or mistakes before new reps.",
      reviewCount: Math.min(3, dueReviewCount),
      href: "/review",
      estimatedMinutes: Math.min(3, dueReviewCount) * 3,
      revealsPattern: false,
    });
  }

  const recognitionProblem = pickProblemForPattern({
    patternId: recommendedPattern.id,
    attempts,
    usedProblemIds,
    now,
    includeSecondary: true,
  });
  usedProblemIds.add(recognitionProblem.id);
  steps.push(
    makeProblemStep({
      type: "Recognition Drill",
      problem: recognitionProblem,
      title: "Recognition drill",
      description: "Choose the pattern from the prompt metadata before solving.",
      targetPatternId: recommendedPattern.id,
    }),
  );

  const focusedProblem = pickProblemForPattern({
    patternId: recommendedPattern.id,
    attempts,
    usedProblemIds,
    now,
  });
  usedProblemIds.add(focusedProblem.id);
  steps.push(
    makeProblemStep({
      type: "Focused Problem",
      problem: focusedProblem,
      title: "Weak-pattern focus",
      description: "Practice the pattern lane most in need of reinforcement.",
      targetPatternId: recommendedPattern.id,
    }),
  );

  const topConfusion = getTopAttemptConfusion(attempts);

  if (topConfusion) {
    const contrastProblem = pickProblemForPattern({
      patternId: topConfusion.correctPatternId,
      attempts,
      usedProblemIds,
      now,
      includeSecondary: true,
    });
    usedProblemIds.add(contrastProblem.id);
    steps.push(
      makeProblemStep({
        type: "Contrast Problem",
        problem: contrastProblem,
        title: "Contrast drill",
        description: "Separate two patterns that have been mixed up before.",
        targetPatternId: topConfusion.correctPatternId,
        secondaryPatternId: topConfusion.selectedPatternId,
      }),
    );
  }

  const readyForBossPattern = getReadyForBossPattern(options.patternProgressById);

  if (readyForBossPattern) {
    const bossPrepProblem = pickProblemForPattern({
      patternId: readyForBossPattern.id,
      attempts,
      usedProblemIds,
      now,
      difficulty: "Medium",
      includeSecondary: true,
    });
    usedProblemIds.add(bossPrepProblem.id);
    steps.push(
      makeProblemStep({
        type: "Boss Prep",
        problem: bossPrepProblem,
        title: "Boss prep",
        description: "Take a medium rep from a pattern close to boss readiness.",
        targetPatternId: readyForBossPattern.id,
      }),
    );
  } else {
    const mixedReviewProblem = pickMixedReviewProblem({
      excludedPatternIds: [
        recommendedPattern.id,
        topConfusion?.correctPatternId ?? "",
      ].filter(Boolean),
      attempts,
      usedProblemIds,
      now,
      patternProgressById: options.patternProgressById,
    });
    usedProblemIds.add(mixedReviewProblem.id);
    steps.push(
      makeProblemStep({
        type: "Mixed Review",
        problem: mixedReviewProblem,
        title: "Mixed review",
        description: "Refresh an older pattern so practice does not narrow too far.",
        targetPatternId: mixedReviewProblem.primaryPatternId,
      }),
    );
  }

  return createSessionFromSteps({
    goal:
      dueReviewCount > 0
        ? "Warm up with due memory work, then practice the highest-value pattern reps for today."
        : "Practice the highest-value recognition, focus, and review reps for today.",
    recommendedPattern,
    steps,
  });
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
