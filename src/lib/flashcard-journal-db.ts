import "server-only";

import type { FlashcardJournalFilters } from "@/lib/flashcard-journal";
import { getPrisma } from "@/lib/prisma";

export type FlashcardJournalItem = {
  id: string;
  patternId: string;
  patternName: string;
  sourceProblemTitle: string | null;
  front: string;
  back: string;
  reviewDueAt: string;
  lastReviewedAt: string | null;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  timesReviewed: number;
  status: string;
  createdAt: string;
};

function getOrderBy(sort: FlashcardJournalFilters["sort"]) {
  switch (sort) {
    case "due_soon":
      return [{ reviewDueAt: "asc" as const }, { createdAt: "desc" as const }];
    case "most_lapses":
      return [{ lapses: "desc" as const }, { createdAt: "desc" as const }];
    case "most_reviewed":
      return [
        { reviewLogs: { _count: "desc" as const } },
        { createdAt: "desc" as const },
      ];
    case "newest":
      return [{ createdAt: "desc" as const }];
  }
}

export async function getFlashcardJournalForUser(
  userProfileId: string,
  filters: FlashcardJournalFilters,
  now = new Date(),
): Promise<FlashcardJournalItem[]> {
  const search = filters.search.trim();
  const flashcards = await getPrisma().flashcard.findMany({
    where: {
      userProfileId,
      status: filters.status,
      ...(filters.patternId !== "all" ? { patternId: filters.patternId } : {}),
      ...(filters.dueStatus === "due"
        ? { reviewDueAt: { lte: now } }
        : filters.dueStatus === "not_due"
          ? { reviewDueAt: { gt: now } }
          : {}),
      ...(search
        ? {
            OR: [
              { front: { contains: search } },
              { back: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      pattern: true,
      sourceAttempt: {
        include: {
          problem: true,
        },
      },
      _count: {
        select: {
          reviewLogs: true,
        },
      },
    },
    orderBy: getOrderBy(filters.sort),
  });

  return flashcards.map((flashcard) => ({
    id: flashcard.id,
    patternId: flashcard.patternId,
    patternName: flashcard.pattern.name,
    sourceProblemTitle: flashcard.sourceAttempt?.problem.title ?? null,
    front: flashcard.front,
    back: flashcard.back,
    reviewDueAt: flashcard.reviewDueAt.toISOString(),
    lastReviewedAt: flashcard.lastReviewedAt?.toISOString() ?? null,
    intervalDays: flashcard.intervalDays,
    repetitions: flashcard.repetitions,
    lapses: flashcard.lapses,
    timesReviewed: flashcard._count.reviewLogs,
    status: flashcard.status,
    createdAt: flashcard.createdAt.toISOString(),
  }));
}

export async function getFlashcardJournalStats(userProfileId: string) {
  const [activeCount, archivedCount, dueCount] = await Promise.all([
    getPrisma().flashcard.count({
      where: { userProfileId, status: "active" },
    }),
    getPrisma().flashcard.count({
      where: { userProfileId, status: "archived" },
    }),
    getPrisma().flashcard.count({
      where: {
        userProfileId,
        status: "active",
        reviewDueAt: { lte: new Date() },
      },
    }),
  ]);

  return {
    activeCount,
    archivedCount,
    dueCount,
  };
}
