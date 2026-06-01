import {
  SolvedStatus as PrismaSolvedStatus,
  type Attempt as DbAttempt,
} from "@/generated/prisma/client";
import { patterns } from "@/data/patterns";
import {
  getGamificationStats,
  type ReviewXpActivity,
} from "@/lib/gamification";
import { getPatternProgress } from "@/lib/mastery";
import { calculateMemoryStreak } from "@/lib/memory-streak";
import { getPrisma } from "@/lib/prisma";
import { progressFromAttempts } from "@/lib/progress";
import { getReviewStats, type ReviewStats } from "@/lib/review/queue";
import type { ReviewRating } from "@/lib/review/types";
import type {
  Attempt,
  Confidence,
  PatternProgress,
  SolvedStatus,
  UserProgress,
} from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type CreateAttemptInput = {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  createdAt?: string;
};

export type UserProgressSnapshot = {
  progress: UserProgress | null;
  dashboardStats: ReturnType<typeof getGamificationStats> | null;
  patternProgress: PatternProgress | null;
  patternProgressById: Record<string, PatternProgress> | null;
  reviewStats: (ReviewStats & { memoryStreak: number }) | null;
};

export type ImportAttemptsResult = {
  importedCount: number;
  skippedCount: number;
};

function toSolvedStatus(solvedStatus: PrismaSolvedStatus): SolvedStatus {
  switch (solvedStatus) {
    case PrismaSolvedStatus.Solved:
      return "Solved";
    case PrismaSolvedStatus.PartiallySolved:
      return "Partially Solved";
    case PrismaSolvedStatus.NotSolved:
      return "Not Solved";
  }
}

function toPrismaSolvedStatus(solvedStatus: SolvedStatus): PrismaSolvedStatus {
  switch (solvedStatus) {
    case "Solved":
      return PrismaSolvedStatus.Solved;
    case "Partially Solved":
      return PrismaSolvedStatus.PartiallySolved;
    case "Not Solved":
      return PrismaSolvedStatus.NotSolved;
  }
}

export function toAppAttempt(attempt: DbAttempt): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: attempt.confidence as Attempt["confidence"],
    reflection: attempt.reflection,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function normalizeCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt) {
    return undefined;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

type PatternMasteryInputs = {
  explanationScores: number[];
  retentionRatings: ReviewRating[];
};

const MAX_PATTERN_SIGNAL_COUNT = 20;
const MAX_RECENT_REVIEW_LOGS = 1000;
const MAX_RECENT_AI_REVIEWS = 500;
const MAX_XP_REVIEW_LOGS = 5000;

function createPatternMasteryInputMap(): Map<string, PatternMasteryInputs> {
  return new Map(
    patterns.map((pattern) => [
      pattern.id,
      {
        explanationScores: [],
        retentionRatings: [],
      },
    ]),
  );
}

async function getPatternMasteryInputMap(
  userProfileId: string,
): Promise<Map<string, PatternMasteryInputs>> {
  const prisma = getPrisma();
  const inputMap = createPatternMasteryInputMap();
  const [aiReviews, reviewLogs] = await Promise.all([
    prisma.aIReview.findMany({
      where: { userProfileId },
      select: {
        patternId: true,
        explanationScore: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_AI_REVIEWS,
    }),
    prisma.reviewLog.findMany({
      where: { userProfileId },
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
      orderBy: { reviewedAt: "desc" },
      take: MAX_RECENT_REVIEW_LOGS,
    }),
  ]);

  for (const review of aiReviews) {
    const input = inputMap.get(review.patternId);

    if (!input || input.explanationScores.length >= MAX_PATTERN_SIGNAL_COUNT) {
      continue;
    }

    input.explanationScores.push(review.explanationScore);
  }

  for (const reviewLog of reviewLogs) {
    const patternId =
      reviewLog.flashcard?.patternId ?? reviewLog.mistake?.patternId;
    const input = patternId ? inputMap.get(patternId) : undefined;

    if (!input || input.retentionRatings.length >= MAX_PATTERN_SIGNAL_COUNT) {
      continue;
    }

    input.retentionRatings.push(reviewLog.rating);
  }

  return inputMap;
}

function getPatternProgressById(
  progress: UserProgress,
  inputMap: Map<string, PatternMasteryInputs>,
): Record<string, PatternProgress> {
  return Object.fromEntries(
    patterns.map((pattern) => {
      const input = inputMap.get(pattern.id);

      return [
        pattern.id,
        getPatternProgress(pattern.id, progress, {
          explanationScores: input?.explanationScores,
          retentionRatings: input?.retentionRatings,
        }),
      ];
    }),
  );
}

function getImportKey({
  problemId,
  selectedPatternId,
  solvedStatus,
  createdAt,
}: {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  createdAt?: string;
}) {
  return [
    problemId,
    selectedPatternId,
    solvedStatus,
    normalizeCreatedAt(createdAt) ?? "no-date",
  ].join("|");
}

async function getReviewXpActivities(
  userProfileId: string,
): Promise<ReviewXpActivity[]> {
  const reviewLogs = await getPrisma().reviewLog.findMany({
    where: { userProfileId },
    select: {
      itemType: true,
      rating: true,
      reviewedAt: true,
      mistakeId: true,
      mistake: {
        select: {
          lapses: true,
        },
      },
    },
    orderBy: { reviewedAt: "asc" },
    take: MAX_XP_REVIEW_LOGS,
  });
  const mistakeAgainCounts = new Map<string, number>();
  const mistakeCurrentLapses = new Map<string, number>();

  for (const reviewLog of reviewLogs) {
    if (reviewLog.itemType !== "Mistake" || !reviewLog.mistakeId) {
      continue;
    }

    mistakeCurrentLapses.set(
      reviewLog.mistakeId,
      reviewLog.mistake?.lapses ?? 0,
    );

    if (reviewLog.rating === "Again") {
      mistakeAgainCounts.set(
        reviewLog.mistakeId,
        (mistakeAgainCounts.get(reviewLog.mistakeId) ?? 0) + 1,
      );
    }
  }
  const mistakePriorLapses = new Map(
    Array.from(mistakeCurrentLapses.entries()).map(
      ([mistakeId, currentLapses]) => [
        mistakeId,
        Math.max(0, currentLapses - (mistakeAgainCounts.get(mistakeId) ?? 0)),
      ],
    ),
  );

  return reviewLogs.map((reviewLog) => {
    const priorLapses = reviewLog.mistakeId
      ? (mistakePriorLapses.get(reviewLog.mistakeId) ?? 0)
      : 0;

    if (
      reviewLog.itemType === "Mistake" &&
      reviewLog.rating === "Again" &&
      reviewLog.mistakeId
    ) {
      mistakePriorLapses.set(
        reviewLog.mistakeId,
        priorLapses + 1,
      );
    }

    return {
      itemType: reviewLog.itemType,
      rating: reviewLog.rating,
      reviewedAt: reviewLog.reviewedAt,
      mistakeHadPriorLapse:
        reviewLog.itemType === "Mistake" ? priorLapses > 0 : false,
    };
  });
}

export async function getCurrentUserAttempts(): Promise<Attempt[] | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const attempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    orderBy: { createdAt: "asc" },
  });

  return attempts.map(toAppAttempt);
}

export async function getCurrentUserProgress() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  return progressFromAttempts(attempts);
}

export async function getCurrentUserPatternProgress(
  patternId: string,
): Promise<PatternProgress | null> {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  const userProfile = await ensureCurrentUserProfile();
  const progress = progressFromAttempts(attempts);
  const patternInputMap = userProfile
    ? await getPatternMasteryInputMap(userProfile.id)
    : createPatternMasteryInputMap();

  return getPatternProgress(patternId, progress, {
    explanationScores: patternInputMap.get(patternId)?.explanationScores,
    retentionRatings: patternInputMap.get(patternId)?.retentionRatings,
  });
}

export async function getCurrentUserDashboardStats() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return getGamificationStats(attempts);
  }

  const [reviewStats, reviewActivities] = await Promise.all([
    getReviewStats(userProfile.id),
    getReviewXpActivities(userProfile.id),
  ]);

  return getGamificationStats(attempts, {
    reviewActivities,
    clearedDueReviewsToday:
      reviewStats.reviewedTodayCount > 0 && reviewStats.totalDueCount === 0,
  });
}

export async function getCurrentUserProgressSnapshot(
  patternId?: string,
): Promise<UserProgressSnapshot> {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return {
      progress: null,
      dashboardStats: null,
      patternProgress: null,
      patternProgressById: null,
      reviewStats: null,
    };
  }

  const progress = progressFromAttempts(attempts);
  const userProfile = await ensureCurrentUserProfile();
  const [reviewStats, reviewActivities, patternInputMap] = userProfile
    ? await Promise.all([
        getReviewStats(userProfile.id),
        getReviewXpActivities(userProfile.id),
        getPatternMasteryInputMap(userProfile.id),
      ])
    : [null, [], createPatternMasteryInputMap()];
  const patternProgressById = getPatternProgressById(progress, patternInputMap);

  return {
    progress,
    dashboardStats: getGamificationStats(attempts, {
      reviewActivities,
      clearedDueReviewsToday:
        reviewStats !== null &&
        reviewStats.reviewedTodayCount > 0 &&
        reviewStats.totalDueCount === 0,
    }),
    patternProgress: patternId
      ? (patternProgressById[patternId] ?? null)
      : null,
    patternProgressById,
    reviewStats: reviewStats
      ? {
          ...reviewStats,
          memoryStreak: calculateMemoryStreak({
            attempts,
            reviewDates: reviewActivities.map(
              (reviewActivity) => new Date(reviewActivity.reviewedAt),
            ),
          }),
        }
      : null,
  };
}

export async function createAttemptForUserProfile(
  userProfileId: string,
  input: CreateAttemptInput,
): Promise<Attempt> {
  const prisma = getPrisma();
  const [problem, selectedPattern] = await Promise.all([
    prisma.problem.findUnique({
      where: { id: input.problemId },
      include: {
        problemPatterns: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    }),
    prisma.pattern.findUnique({
      where: { id: input.selectedPatternId },
    }),
  ]);

  const correctPatternId = problem?.problemPatterns[0]?.patternId;

  if (!problem || !correctPatternId) {
    throw new Error("Problem seed data was not found.");
  }

  if (!selectedPattern) {
    throw new Error("Selected pattern was not found.");
  }

  const createdAt = normalizeCreatedAt(input.createdAt);
  const dbAttempt = await prisma.attempt.create({
    data: {
      userProfileId,
      problemId: input.problemId,
      selectedPatternId: input.selectedPatternId,
      correctPatternId,
      wasPatternCorrect: input.selectedPatternId === correctPatternId,
      solvedStatus: toPrismaSolvedStatus(input.solvedStatus),
      timeSpentMinutes: input.timeSpentMinutes,
      confidence: input.confidence,
      reflection: input.reflection.trim(),
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });

  return toAppAttempt(dbAttempt);
}

export async function createCurrentUserAttempt(
  input: CreateAttemptInput,
): Promise<Attempt | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  return createAttemptForUserProfile(userProfile.id, input);
}

export async function importCurrentUserAttempts(
  inputs: CreateAttemptInput[],
): Promise<ImportAttemptsResult | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const existingAttempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    select: {
      problemId: true,
      selectedPatternId: true,
      solvedStatus: true,
      createdAt: true,
    },
  });
  const seen = new Set(
    existingAttempts.map((attempt) =>
      getImportKey({
        problemId: attempt.problemId,
        selectedPatternId: attempt.selectedPatternId,
        solvedStatus: toSolvedStatus(attempt.solvedStatus),
        createdAt: attempt.createdAt.toISOString(),
      }),
    ),
  );
  let importedCount = 0;
  let skippedCount = 0;

  for (const input of inputs) {
    const key = getImportKey(input);

    if (seen.has(key)) {
      skippedCount += 1;
      continue;
    }

    try {
      const importedAttempt = await createAttemptForUserProfile(
        userProfile.id,
        input,
      );
      seen.add(key);
      seen.add(getImportKey(importedAttempt));
      importedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  return { importedCount, skippedCount };
}
