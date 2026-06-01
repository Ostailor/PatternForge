import "server-only";

import { getPrisma } from "@/lib/prisma";
import type { MistakeJournalFilters } from "@/lib/mistake-journal";

export type MistakeJournalItem = {
  id: string;
  patternId: string;
  patternName: string;
  problemTitle: string;
  mistakeType: string;
  description: string;
  correction: string;
  reviewDueAt: string;
  lastReviewedAt: string | null;
  timesReviewed: number;
  lapses: number;
  status: string;
  createdAt: string;
};

function getOrderBy(sort: MistakeJournalFilters["sort"]) {
  switch (sort) {
    case "oldest":
      return [{ createdAt: "asc" as const }];
    case "most_lapses":
      return [{ lapses: "desc" as const }, { createdAt: "desc" as const }];
    case "due_soon":
      return [{ reviewDueAt: "asc" as const }, { createdAt: "desc" as const }];
    case "newest":
      return [{ createdAt: "desc" as const }];
  }
}

export async function getMistakeJournalForUser(
  userProfileId: string,
  filters: MistakeJournalFilters,
  now = new Date(),
): Promise<MistakeJournalItem[]> {
  const search = filters.search.trim();
  const mistakes = await getPrisma().mistake.findMany({
    where: {
      userProfileId,
      status: filters.status,
      ...(filters.patternId !== "all" ? { patternId: filters.patternId } : {}),
      ...(filters.reviewStatus === "due"
        ? { reviewDueAt: { lte: now } }
        : filters.reviewStatus === "not_due"
          ? { reviewDueAt: { gt: now } }
          : {}),
      ...(search
        ? {
            OR: [
              { mistakeType: { contains: search } },
              { description: { contains: search } },
              { correction: { contains: search } },
            ],
          }
        : {}),
    },
    include: {
      pattern: true,
      problem: true,
      _count: {
        select: {
          reviewLogs: true,
        },
      },
    },
    orderBy: getOrderBy(filters.sort),
  });

  return mistakes.map((mistake) => ({
    id: mistake.id,
    patternId: mistake.patternId,
    patternName: mistake.pattern.name,
    problemTitle: mistake.problem.title,
    mistakeType: mistake.mistakeType,
    description: mistake.description,
    correction: mistake.correction,
    reviewDueAt: mistake.reviewDueAt.toISOString(),
    lastReviewedAt: mistake.lastReviewedAt?.toISOString() ?? null,
    timesReviewed: mistake._count.reviewLogs,
    lapses: mistake.lapses,
    status: mistake.status,
    createdAt: mistake.createdAt.toISOString(),
  }));
}

export async function getMistakeJournalStats(userProfileId: string) {
  const [activeCount, archivedCount, dueCount] = await Promise.all([
    getPrisma().mistake.count({
      where: { userProfileId, status: "active" },
    }),
    getPrisma().mistake.count({
      where: { userProfileId, status: "archived" },
    }),
    getPrisma().mistake.count({
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
