import { getPrisma } from "@/lib/prisma";

export type PatternConfusionRecord = {
  id: string;
  userProfileId: string;
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type PatternConfusionSummary = {
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: string;
  selectedPatternName: string;
  correctPatternName: string;
};

export type ConfusionPatternPair = {
  selectedPatternId: string;
  selectedPatternName: string;
  correctPatternId: string;
  correctPatternName: string;
};

export type PatternConfusionInsight = PatternConfusionSummary & {
  explanation: string;
  recommendedContrastDrill: string;
};

type PatternConfusionUpsertArgs = {
  where: {
    userProfileId_selectedPatternId_correctPatternId: {
      userProfileId: string;
      selectedPatternId: string;
      correctPatternId: string;
    };
  };
  create: {
    userProfileId: string;
    selectedPatternId: string;
    correctPatternId: string;
    count: number;
    lastSeenAt: Date;
  };
  update: {
    count: { increment: number };
    lastSeenAt: Date;
  };
};

type PatternConfusionWriteClient = {
  patternConfusion: {
    upsert(args: PatternConfusionUpsertArgs): Promise<PatternConfusionRecord>;
  };
};

const DEFAULT_TOP_CONFUSION_LIMIT = 5;

function normalizeId(value: string): string {
  return value.trim();
}

function includesAny(value: string, needles: string[]): boolean {
  const normalizedValue = value.toLowerCase();

  return needles.some((needle) => normalizedValue.includes(needle));
}

function isSlidingWindowTwoPointersPair(pair: ConfusionPatternPair): boolean {
  const values = [
    pair.selectedPatternId,
    pair.selectedPatternName,
    pair.correctPatternId,
    pair.correctPatternName,
  ];

  return (
    values.some((value) => includesAny(value, ["sliding-window", "sliding window"])) &&
    values.some((value) => includesAny(value, ["two-pointers", "two pointers"]))
  );
}

function isBfsDfsPair(pair: ConfusionPatternPair): boolean {
  const values = [
    pair.selectedPatternId,
    pair.selectedPatternName,
    pair.correctPatternId,
    pair.correctPatternName,
  ];

  return (
    values.some((value) => includesAny(value, ["bfs"])) &&
    values.some((value) => includesAny(value, ["dfs"]))
  );
}

function isHeapSortingPair(pair: ConfusionPatternPair): boolean {
  const values = [
    pair.selectedPatternId,
    pair.selectedPatternName,
    pair.correctPatternId,
    pair.correctPatternName,
  ];

  return (
    values.some((value) =>
      includesAny(value, ["heap", "priority queue", "priority-queue"]),
    ) && values.some((value) => includesAny(value, ["sorting", "sort"]))
  );
}

function toSummary(row: {
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: Date;
  selectedPattern: { name: string };
  correctPattern: { name: string };
}): PatternConfusionSummary {
  return {
    selectedPatternId: row.selectedPatternId,
    correctPatternId: row.correctPatternId,
    count: row.count,
    lastSeenAt: row.lastSeenAt.toISOString(),
    selectedPatternName: row.selectedPattern.name,
    correctPatternName: row.correctPattern.name,
  };
}

export async function updatePatternConfusionOnAttemptWithClient(
  client: PatternConfusionWriteClient,
  userProfileId: string,
  selectedPatternId: string,
  correctPatternId: string,
  now = new Date(),
): Promise<PatternConfusionRecord | null> {
  const scopedUserProfileId = normalizeId(userProfileId);
  const scopedSelectedPatternId = normalizeId(selectedPatternId);
  const scopedCorrectPatternId = normalizeId(correctPatternId);

  if (
    !scopedUserProfileId ||
    !scopedSelectedPatternId ||
    !scopedCorrectPatternId ||
    scopedSelectedPatternId === scopedCorrectPatternId
  ) {
    return null;
  }

  return client.patternConfusion.upsert({
    where: {
      userProfileId_selectedPatternId_correctPatternId: {
        userProfileId: scopedUserProfileId,
        selectedPatternId: scopedSelectedPatternId,
        correctPatternId: scopedCorrectPatternId,
      },
    },
    create: {
      userProfileId: scopedUserProfileId,
      selectedPatternId: scopedSelectedPatternId,
      correctPatternId: scopedCorrectPatternId,
      count: 1,
      lastSeenAt: now,
    },
    update: {
      count: { increment: 1 },
      lastSeenAt: now,
    },
  });
}

export async function updatePatternConfusionOnAttempt(
  userProfileId: string,
  selectedPatternId: string,
  correctPatternId: string,
): Promise<PatternConfusionRecord | null> {
  return updatePatternConfusionOnAttemptWithClient(
    getPrisma(),
    userProfileId,
    selectedPatternId,
    correctPatternId,
  );
}

export async function getTopPatternConfusions(
  userProfileId: string,
  limit = DEFAULT_TOP_CONFUSION_LIMIT,
): Promise<PatternConfusionSummary[]> {
  const scopedUserProfileId = normalizeId(userProfileId);

  if (!scopedUserProfileId) {
    return [];
  }

  const rows = await getPrisma().patternConfusion.findMany({
    where: { userProfileId: scopedUserProfileId },
    include: {
      selectedPattern: {
        select: { name: true },
      },
      correctPattern: {
        select: { name: true },
      },
    },
    orderBy: [{ count: "desc" }, { lastSeenAt: "desc" }],
    take: Math.max(1, limit),
  });

  return rows.map(toSummary);
}

export function getRuleBasedConfusionExplanation(
  pair: ConfusionPatternPair,
): string {
  if (isSlidingWindowTwoPointersPair(pair)) {
    return "Sliding Window usually tracks a contiguous range that expands and shrinks around a constraint. Two Pointers often uses two indices moving toward each other or through sorted data.";
  }

  if (isBfsDfsPair(pair)) {
    return "BFS is often better for shortest path or level-order traversal. DFS is often better for exhaustive traversal, recursion, and connected components.";
  }

  if (isHeapSortingPair(pair)) {
    return "Heap / Priority Queue is useful when repeatedly needing top-k or dynamic priority. Sorting is useful when order can be fixed once.";
  }

  return `${pair.selectedPatternName} and ${pair.correctPatternName} share surface cues, but the deciding signal is which invariant the problem asks you to maintain. Compare the recognition clues before choosing an approach.`;
}

export function buildConfusionInsight(
  summary: PatternConfusionSummary,
): PatternConfusionInsight {
  const pair = {
    selectedPatternId: summary.selectedPatternId,
    selectedPatternName: summary.selectedPatternName,
    correctPatternId: summary.correctPatternId,
    correctPatternName: summary.correctPatternName,
  };

  return {
    ...summary,
    explanation: getRuleBasedConfusionExplanation(pair),
    recommendedContrastDrill: `Run a ${summary.selectedPatternName} vs ${summary.correctPatternName} contrast drill: compare clues, state the invariant for each, then solve one targeted example for the correct pattern.`,
  };
}

export async function getConfusionInsight(
  userProfileId: string,
  selectedPatternId: string,
  correctPatternId: string,
): Promise<PatternConfusionInsight | null> {
  const scopedUserProfileId = normalizeId(userProfileId);
  const scopedSelectedPatternId = normalizeId(selectedPatternId);
  const scopedCorrectPatternId = normalizeId(correctPatternId);

  if (!scopedUserProfileId || !scopedSelectedPatternId || !scopedCorrectPatternId) {
    return null;
  }

  const row = await getPrisma().patternConfusion.findFirst({
    where: {
      userProfileId: scopedUserProfileId,
      selectedPatternId: scopedSelectedPatternId,
      correctPatternId: scopedCorrectPatternId,
    },
    include: {
      selectedPattern: {
        select: { name: true },
      },
      correctPattern: {
        select: { name: true },
      },
    },
  });

  return row ? buildConfusionInsight(toSummary(row)) : null;
}
