import { getPrisma } from "@/lib/prisma";
import { calculateNextReview } from "@/lib/review/scheduler";
import {
  isReviewRating,
  type ReviewItemType,
  type ReviewRating,
  type ReviewScheduleState,
} from "@/lib/review/types";

export type ReviewQueueItem = ReviewScheduleState & {
  id: string;
  itemType: ReviewItemType;
  patternId: string;
  patternName: string;
  problemTitle: string | null;
  prompt: string;
  answer: string;
  reviewDueAt: Date;
  lastReviewedAt: Date | null;
  status: string;
};

export type WeakestReviewPattern = {
  patternId: string;
  patternName: string;
  retentionScore: number;
  reviewedCount: number;
  difficultCount: number;
};

export type ReviewStats = {
  dueFlashcardsCount: number;
  dueMistakesCount: number;
  totalDueCount: number;
  reviewedTodayCount: number;
  retentionScore: number | null;
  recentReviewCount: number;
  weakestReviewPattern: WeakestReviewPattern | null;
};

export type RecentReviewHistoryItem = {
  id: string;
  itemType: ReviewItemType;
  rating: ReviewRating;
  reviewedAt: Date;
  patternName: string | null;
  problemTitle: string | null;
};

export type ReviewSubmissionResult = {
  id: string;
  itemType: ReviewItemType;
  previousIntervalDays: number;
  nextIntervalDays: number;
  nextReviewDueAt: Date;
};

export class ReviewValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReviewValidationError";
  }
}

export class ReviewItemAccessError extends Error {
  constructor() {
    super("Review item was not found for the current user.");
    this.name = "ReviewItemAccessError";
  }
}

const DEFAULT_QUEUE_LIMIT = 50;
const RECENT_REVIEW_WINDOW_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DueFlashcard = Awaited<ReturnType<typeof getDueFlashcards>>[number];
type DueMistake = Awaited<ReturnType<typeof getDueMistakes>>[number];

function requireNonEmpty(value: string, message: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new ReviewValidationError(message);
  }

  return trimmed;
}

export function validateReviewRequest(
  userProfileId: string,
  itemId: string,
  rating: string,
): ReviewRating {
  requireNonEmpty(userProfileId, "User profile ID is required.");
  requireNonEmpty(itemId, "Review item ID is required.");

  if (!isReviewRating(rating)) {
    throw new ReviewValidationError("Review rating is invalid.");
  }

  return rating;
}

export function getRatingValue(rating: ReviewRating): number {
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

export function toRetentionScore(ratings: ReviewRating[]): number | null {
  if (ratings.length === 0) {
    return null;
  }

  const total = ratings.reduce(
    (sum, rating) => sum + getRatingValue(rating),
    0,
  );

  return Math.round(total / ratings.length);
}

export function sortReviewQueueItems(
  items: ReviewQueueItem[],
): ReviewQueueItem[] {
  return items.slice().sort((a, b) => {
    const dueDelta = a.reviewDueAt.getTime() - b.reviewDueAt.getTime();

    if (dueDelta !== 0) {
      return dueDelta;
    }

    return a.itemType.localeCompare(b.itemType);
  });
}

function getUtcDayWindow(now = new Date()) {
  const start = new Date(now);

  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function getRecentReviewWindow(now = new Date()) {
  return new Date(now.getTime() - RECENT_REVIEW_WINDOW_DAYS * DAY_IN_MS);
}

function toFlashcardQueueItem(flashcard: DueFlashcard): ReviewQueueItem {
  return {
    id: flashcard.id,
    itemType: "Flashcard",
    patternId: flashcard.patternId,
    patternName: flashcard.pattern.name,
    problemTitle: flashcard.sourceAttempt?.problem.title ?? null,
    prompt: flashcard.front,
    answer: flashcard.back,
    reviewDueAt: flashcard.reviewDueAt,
    lastReviewedAt: flashcard.lastReviewedAt,
    intervalDays: flashcard.intervalDays,
    easeFactor: flashcard.easeFactor,
    repetitions: flashcard.repetitions,
    lapses: flashcard.lapses,
    status: flashcard.status,
  };
}

function toMistakeQueueItem(mistake: DueMistake): ReviewQueueItem {
  return {
    id: mistake.id,
    itemType: "Mistake",
    patternId: mistake.patternId,
    patternName: mistake.pattern.name,
    problemTitle: mistake.problem.title,
    prompt: mistake.description,
    answer: mistake.correction,
    reviewDueAt: mistake.reviewDueAt,
    lastReviewedAt: mistake.lastReviewedAt,
    intervalDays: mistake.intervalDays,
    easeFactor: mistake.easeFactor,
    repetitions: mistake.repetitions,
    lapses: mistake.lapses,
    status: mistake.status,
  };
}

export async function getDueFlashcards(
  userProfileId: string,
  now = new Date(),
  limit = DEFAULT_QUEUE_LIMIT,
) {
  const scopedUserProfileId = requireNonEmpty(
    userProfileId,
    "User profile ID is required.",
  );

  return getPrisma().flashcard.findMany({
    where: {
      userProfileId: scopedUserProfileId,
      status: "active",
      reviewDueAt: {
        lte: now,
      },
    },
    include: {
      pattern: true,
      sourceAttempt: {
        include: {
          problem: true,
        },
      },
    },
    orderBy: { reviewDueAt: "asc" },
    take: limit,
  });
}

export async function getDueMistakes(
  userProfileId: string,
  now = new Date(),
  limit = DEFAULT_QUEUE_LIMIT,
) {
  const scopedUserProfileId = requireNonEmpty(
    userProfileId,
    "User profile ID is required.",
  );

  return getPrisma().mistake.findMany({
    where: {
      userProfileId: scopedUserProfileId,
      status: "active",
      reviewDueAt: {
        lte: now,
      },
    },
    include: {
      pattern: true,
      problem: true,
    },
    orderBy: { reviewDueAt: "asc" },
    take: limit,
  });
}

export async function getReviewQueue(
  userProfileId: string,
  now = new Date(),
): Promise<ReviewQueueItem[]> {
  const [flashcards, mistakes] = await Promise.all([
    getDueFlashcards(userProfileId, now),
    getDueMistakes(userProfileId, now),
  ]);

  return sortReviewQueueItems([
    ...flashcards.map(toFlashcardQueueItem),
    ...mistakes.map(toMistakeQueueItem),
  ]);
}

function getWeakestReviewPatternFromLogs(
  logs: Awaited<ReturnType<typeof getRecentReviewLogs>>,
): WeakestReviewPattern | null {
  const byPattern = new Map<
    string,
    {
      patternName: string;
      ratings: ReviewRating[];
      difficultCount: number;
    }
  >();

  for (const log of logs) {
    const pattern =
      log.itemType === "Flashcard"
        ? log.flashcard?.pattern
        : log.mistake?.pattern;

    if (!pattern) {
      continue;
    }

    const current = byPattern.get(pattern.id) ?? {
      patternName: pattern.name,
      ratings: [],
      difficultCount: 0,
    };
    current.ratings.push(log.rating);
    if (log.rating === "Again" || log.rating === "Hard") {
      current.difficultCount += 1;
    }
    byPattern.set(pattern.id, current);
  }

  return Array.from(byPattern.entries())
    .filter(([, pattern]) => pattern.difficultCount > 0)
    .map(([patternId, pattern]) => ({
      patternId,
      patternName: pattern.patternName,
      retentionScore: toRetentionScore(pattern.ratings) ?? 0,
      reviewedCount: pattern.ratings.length,
      difficultCount: pattern.difficultCount,
    }))
    .sort(
      (a, b) =>
        b.difficultCount - a.difficultCount ||
        a.retentionScore - b.retentionScore ||
        b.reviewedCount - a.reviewedCount ||
        a.patternName.localeCompare(b.patternName),
    )[0] ?? null;
}

async function getRecentReviewLogs(userProfileId: string, now = new Date()) {
  return getPrisma().reviewLog.findMany({
    where: {
      userProfileId,
      reviewedAt: {
        gte: getRecentReviewWindow(now),
      },
    },
    include: {
      flashcard: {
        include: {
          pattern: true,
          sourceAttempt: {
            include: {
              problem: true,
            },
          },
        },
      },
      mistake: {
        include: {
          pattern: true,
          problem: true,
        },
      },
    },
    orderBy: { reviewedAt: "desc" },
  });
}

export async function getRecentReviewHistory(
  userProfileId: string,
  limit = 10,
): Promise<RecentReviewHistoryItem[]> {
  const scopedUserProfileId = requireNonEmpty(
    userProfileId,
    "User profile ID is required.",
  );

  const logs = await getPrisma().reviewLog.findMany({
    where: {
      userProfileId: scopedUserProfileId,
    },
    include: {
      flashcard: {
        include: {
          pattern: true,
          sourceAttempt: {
            include: {
              problem: true,
            },
          },
        },
      },
      mistake: {
        include: {
          pattern: true,
          problem: true,
        },
      },
    },
    orderBy: { reviewedAt: "desc" },
    take: limit,
  });

  return logs.map((log) => ({
    id: log.id,
    itemType: log.itemType,
    rating: log.rating,
    reviewedAt: log.reviewedAt,
    patternName:
      log.itemType === "Flashcard"
        ? (log.flashcard?.pattern.name ?? null)
        : (log.mistake?.pattern.name ?? null),
    problemTitle:
      log.itemType === "Flashcard"
        ? (log.flashcard?.sourceAttempt?.problem.title ?? null)
        : (log.mistake?.problem.title ?? null),
  }));
}

export async function getReviewStats(
  userProfileId: string,
  now = new Date(),
): Promise<ReviewStats> {
  const scopedUserProfileId = requireNonEmpty(
    userProfileId,
    "User profile ID is required.",
  );
  const prisma = getPrisma();
  const { start, end } = getUtcDayWindow(now);

  const [
    dueFlashcardsCount,
    dueMistakesCount,
    reviewedTodayCount,
    recentReviewLogs,
  ] = await Promise.all([
    prisma.flashcard.count({
      where: {
        userProfileId: scopedUserProfileId,
        status: "active",
        reviewDueAt: { lte: now },
      },
    }),
    prisma.mistake.count({
      where: {
        userProfileId: scopedUserProfileId,
        status: "active",
        reviewDueAt: { lte: now },
      },
    }),
    prisma.reviewLog.count({
      where: {
        userProfileId: scopedUserProfileId,
        reviewedAt: {
          gte: start,
          lt: end,
        },
      },
    }),
    getRecentReviewLogs(scopedUserProfileId, now),
  ]);
  const recentRatings = recentReviewLogs.map((log) => log.rating);

  return {
    dueFlashcardsCount,
    dueMistakesCount,
    totalDueCount: dueFlashcardsCount + dueMistakesCount,
    reviewedTodayCount,
    retentionScore: toRetentionScore(recentRatings),
    recentReviewCount: recentRatings.length,
    weakestReviewPattern: getWeakestReviewPatternFromLogs(recentReviewLogs),
  };
}

export async function submitFlashcardReview(
  userProfileId: string,
  flashcardId: string,
  rating: string,
): Promise<ReviewSubmissionResult> {
  const validatedRating = validateReviewRequest(
    userProfileId,
    flashcardId,
    rating,
  );
  const reviewedAt = new Date();
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const flashcard = await tx.flashcard.findFirst({
      where: {
        id: flashcardId.trim(),
        userProfileId: userProfileId.trim(),
        status: "active",
      },
    });

    if (!flashcard) {
      throw new ReviewItemAccessError();
    }

    const nextReview = calculateNextReview({
      intervalDays: flashcard.intervalDays,
      easeFactor: flashcard.easeFactor,
      repetitions: flashcard.repetitions,
      lapses: flashcard.lapses,
      rating: validatedRating,
      reviewedAt,
    });

    await tx.flashcard.update({
      where: { id: flashcard.id },
      data: {
        intervalDays: nextReview.nextIntervalDays,
        easeFactor: nextReview.nextEaseFactor,
        repetitions: nextReview.nextRepetitions,
        lapses: nextReview.nextLapses,
        lastReviewedAt: reviewedAt,
        reviewDueAt: nextReview.nextReviewDueAt,
      },
    });

    await tx.reviewLog.create({
      data: {
        userProfileId: flashcard.userProfileId,
        flashcardId: flashcard.id,
        itemType: "Flashcard",
        rating: validatedRating,
        previousIntervalDays: flashcard.intervalDays,
        nextIntervalDays: nextReview.nextIntervalDays,
        reviewedAt,
      },
    });

    return {
      id: flashcard.id,
      itemType: "Flashcard",
      previousIntervalDays: flashcard.intervalDays,
      nextIntervalDays: nextReview.nextIntervalDays,
      nextReviewDueAt: nextReview.nextReviewDueAt,
    };
  });
}

export async function submitMistakeReview(
  userProfileId: string,
  mistakeId: string,
  rating: string,
): Promise<ReviewSubmissionResult> {
  const validatedRating = validateReviewRequest(userProfileId, mistakeId, rating);
  const reviewedAt = new Date();
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const mistake = await tx.mistake.findFirst({
      where: {
        id: mistakeId.trim(),
        userProfileId: userProfileId.trim(),
        status: "active",
      },
    });

    if (!mistake) {
      throw new ReviewItemAccessError();
    }

    const nextReview = calculateNextReview({
      intervalDays: mistake.intervalDays,
      easeFactor: mistake.easeFactor,
      repetitions: mistake.repetitions,
      lapses: mistake.lapses,
      rating: validatedRating,
      reviewedAt,
    });

    await tx.mistake.update({
      where: { id: mistake.id },
      data: {
        intervalDays: nextReview.nextIntervalDays,
        easeFactor: nextReview.nextEaseFactor,
        repetitions: nextReview.nextRepetitions,
        lapses: nextReview.nextLapses,
        lastReviewedAt: reviewedAt,
        reviewDueAt: nextReview.nextReviewDueAt,
      },
    });

    await tx.reviewLog.create({
      data: {
        userProfileId: mistake.userProfileId,
        mistakeId: mistake.id,
        itemType: "Mistake",
        rating: validatedRating,
        previousIntervalDays: mistake.intervalDays,
        nextIntervalDays: nextReview.nextIntervalDays,
        reviewedAt,
      },
    });

    return {
      id: mistake.id,
      itemType: "Mistake",
      previousIntervalDays: mistake.intervalDays,
      nextIntervalDays: nextReview.nextIntervalDays,
      nextReviewDueAt: nextReview.nextReviewDueAt,
    };
  });
}
