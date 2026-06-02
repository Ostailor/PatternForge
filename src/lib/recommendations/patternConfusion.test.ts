import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConfusionInsight,
  getRuleBasedConfusionExplanation,
  updatePatternConfusionOnAttemptWithClient,
} from "@/lib/recommendations/patternConfusion";

test("does not write confusion rows for correct pattern selections", async () => {
  let upsertCalled = false;
  const client = {
    patternConfusion: {
      async upsert() {
        upsertCalled = true;
        const now = new Date("2026-06-01T12:00:00.000Z");

        return {
          id: "unused",
          userProfileId: "user-1",
          selectedPatternId: "sliding-window",
          correctPatternId: "sliding-window",
          count: 1,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        };
      },
    },
  };

  await updatePatternConfusionOnAttemptWithClient(
    client,
    "user-1",
    "sliding-window",
    "sliding-window",
    new Date("2026-06-01T12:00:00.000Z"),
  );

  assert.equal(upsertCalled, false);
});

test("increments existing confusion pair and updates last seen timestamp", async () => {
  const now = new Date("2026-06-01T12:00:00.000Z");
  let upsertArgs: unknown;
  const client = {
    patternConfusion: {
      async upsert(args: unknown) {
        upsertArgs = args;
        return {
          id: "confusion-1",
          userProfileId: "user-1",
          selectedPatternId: "two-pointers",
          correctPatternId: "sliding-window",
          count: 2,
          lastSeenAt: now,
          createdAt: now,
          updatedAt: now,
        };
      },
    },
  };

  const result = await updatePatternConfusionOnAttemptWithClient(
    client,
    "user-1",
    "two-pointers",
    "sliding-window",
    now,
  );

  assert.equal(result?.count, 2);
  assert.deepEqual(upsertArgs, {
    where: {
      userProfileId_selectedPatternId_correctPatternId: {
        userProfileId: "user-1",
        selectedPatternId: "two-pointers",
        correctPatternId: "sliding-window",
      },
    },
    create: {
      userProfileId: "user-1",
      selectedPatternId: "two-pointers",
      correctPatternId: "sliding-window",
      count: 1,
      lastSeenAt: now,
    },
    update: {
      count: { increment: 1 },
      lastSeenAt: now,
    },
  });
});

test("uses rule-based explanation for sliding window and two pointers", () => {
  const explanation = getRuleBasedConfusionExplanation({
    selectedPatternId: "two-pointers",
    selectedPatternName: "Two Pointers",
    correctPatternId: "sliding-window",
    correctPatternName: "Sliding Window",
  });

  assert.match(explanation, /contiguous range/i);
  assert.match(explanation, /two indices/i);
});

test("uses rule-based explanation for bfs and dfs", () => {
  const explanation = getRuleBasedConfusionExplanation({
    selectedPatternId: "dfs",
    selectedPatternName: "DFS",
    correctPatternId: "bfs",
    correctPatternName: "BFS",
  });

  assert.match(explanation, /shortest path/i);
  assert.match(explanation, /exhaustive traversal/i);
});

test("builds confusion insight with recommended contrast drill", () => {
  const insight = buildConfusionInsight({
    selectedPatternId: "heap-priority-queue",
    selectedPatternName: "Heap / Priority Queue",
    correctPatternId: "sorting",
    correctPatternName: "Sorting",
    count: 4,
    lastSeenAt: "2026-06-01T12:00:00.000Z",
  });

  assert.equal(insight.selectedPatternName, "Heap / Priority Queue");
  assert.equal(insight.correctPatternName, "Sorting");
  assert.equal(insight.count, 4);
  assert.match(insight.explanation, /top-k/i);
  assert.match(insight.recommendedContrastDrill, /Heap \/ Priority Queue vs Sorting/);
});
