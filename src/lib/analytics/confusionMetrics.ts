import "server-only";

import { getPrisma } from "@/lib/prisma";

import type { PatternConfusionMetric } from "./types";

type ConfusionBucket = {
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: Date;
};

function getConfusionKey(selectedPatternId: string, correctPatternId: string): string {
  return `${selectedPatternId}:${correctPatternId}`;
}

function compareConfusions(
  a: PatternConfusionMetric,
  b: PatternConfusionMetric,
): number {
  return (
    b.count - a.count ||
    new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime() ||
    a.selectedPatternName.localeCompare(b.selectedPatternName) ||
    a.correctPatternName.localeCompare(b.correctPatternName)
  );
}

export function getMostConfusedPatternPair(
  confusions: PatternConfusionMetric[],
): PatternConfusionMetric | null {
  return confusions.slice().sort(compareConfusions)[0] ?? null;
}

export async function getPatternConfusions(
  userProfileId: string,
): Promise<PatternConfusionMetric[]> {
  const scopedUserProfileId = userProfileId.trim();

  if (!scopedUserProfileId) {
    return [];
  }

  const attempts = await getPrisma().attempt.findMany({
    where: {
      userProfileId: scopedUserProfileId,
      wasPatternCorrect: false,
    },
    select: {
      selectedPatternId: true,
      correctPatternId: true,
      createdAt: true,
      selectedPattern: {
        select: {
          name: true,
        },
      },
      correctPattern: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const buckets = new Map<string, ConfusionBucket & {
    selectedPatternName: string;
    correctPatternName: string;
  }>();

  for (const attempt of attempts) {
    if (attempt.selectedPatternId === attempt.correctPatternId) {
      continue;
    }

    const key = getConfusionKey(
      attempt.selectedPatternId,
      attempt.correctPatternId,
    );
    const current = buckets.get(key);

    if (!current) {
      buckets.set(key, {
        selectedPatternId: attempt.selectedPatternId,
        correctPatternId: attempt.correctPatternId,
        selectedPatternName: attempt.selectedPattern.name,
        correctPatternName: attempt.correctPattern.name,
        count: 1,
        lastSeenAt: attempt.createdAt,
      });
      continue;
    }

    current.count += 1;
    if (attempt.createdAt.getTime() > current.lastSeenAt.getTime()) {
      current.lastSeenAt = attempt.createdAt;
    }
  }

  return Array.from(buckets.values())
    .map((confusion) => ({
      selectedPatternId: confusion.selectedPatternId,
      correctPatternId: confusion.correctPatternId,
      count: confusion.count,
      lastSeenAt: confusion.lastSeenAt.toISOString(),
      selectedPatternName: confusion.selectedPatternName,
      correctPatternName: confusion.correctPatternName,
    }))
    .sort(compareConfusions);
}
