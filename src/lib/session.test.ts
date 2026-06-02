import assert from "node:assert/strict";
import test from "node:test";

import { generateDailySession } from "@/lib/session";
import type { Attempt, PatternProgress } from "@/lib/types";

const now = new Date("2026-06-01T12:00:00.000Z");

function attempt(overrides: Partial<Attempt>): Attempt {
  return {
    id: `attempt-${overrides.problemId ?? "problem"}`,
    problemId: "two-sum",
    selectedPatternId: "arrays-hashing",
    correctPatternId: "arrays-hashing",
    wasPatternCorrect: true,
    solvedStatus: "Solved",
    timeSpentMinutes: 12,
    confidence: 4,
    reflection: "ok",
    createdAt: now.toISOString(),
    ...overrides,
  };
}

function progress(
  patternId: string,
  overrides: Partial<PatternProgress>,
): PatternProgress {
  return {
    patternId,
    recognitionCorrect: 1,
    recognitionAttempts: 1,
    solvedCount: 1,
    attemptedCount: 1,
    masteryScore: 50,
    retentionScore: 70,
    ...overrides,
  };
}

test("new users get beginner-friendly arrays and two pointers steps", () => {
  const session = generateDailySession([], undefined, { now });

  assert.ok(session.steps.length >= 3);
  assert.ok(session.steps.length <= 5);
  assert.deepEqual(
    session.steps.map((step) => step.type),
    ["Recognition Drill", "Focused Problem", "Mixed Review"],
  );
  assert.ok(
    session.problems.every((item) =>
      ["arrays-hashing", "two-pointers"].includes(
        item.problem.primaryPatternId,
      ),
    ),
  );
  assert.ok(session.steps.every((step) => step.revealsPattern === false));
});

test("due reviews are placed first as a warmup", () => {
  const session = generateDailySession(
    [attempt({ problemId: "two-sum" })],
    undefined,
    {
      now,
      reviewStats: {
        dueFlashcardsCount: 2,
        dueMistakesCount: 1,
        totalDueCount: 3,
      },
    },
  );

  assert.equal(session.steps[0].type, "Due Review Warmup");
  assert.equal(session.steps[0].reviewCount, 3);
  assert.equal(session.steps[0].href, "/review");
});

test("repeated recognition misses add a contrast problem", () => {
  const session = generateDailySession(
    [
      attempt({
        id: "miss-1",
        problemId: "best-time-to-buy-and-sell-stock",
        selectedPatternId: "two-pointers",
        correctPatternId: "sliding-window",
        wasPatternCorrect: false,
      }),
      attempt({
        id: "miss-2",
        problemId: "longest-substring-without-repeating-characters",
        selectedPatternId: "two-pointers",
        correctPatternId: "sliding-window",
        wasPatternCorrect: false,
      }),
    ],
    undefined,
    { now },
  );

  const contrastStep = session.steps.find(
    (step) => step.type === "Contrast Problem",
  );

  assert.ok(contrastStep);
  assert.equal(contrastStep?.targetPatternId, "sliding-window");
  assert.equal(contrastStep?.secondaryPatternId, "two-pointers");
  assert.equal(contrastStep?.revealsPattern, false);
});

test("high mastery and retention add a medium boss prep problem", () => {
  const session = generateDailySession(
    [attempt({ problemId: "3sum", correctPatternId: "two-pointers" })],
    undefined,
    {
      now,
      patternProgressById: {
        "two-pointers": progress("two-pointers", {
          masteryScore: 82,
          retentionScore: 84,
          attemptedCount: 3,
          solvedCount: 3,
        }),
      },
    },
  );

  const bossPrepStep = session.steps.find((step) => step.type === "Boss Prep");

  assert.ok(bossPrepStep);
  assert.equal(bossPrepStep?.problem?.difficulty, "Medium");
  assert.equal(bossPrepStep?.targetPatternId, "two-pointers");
});

test("focused practice avoids recently attempted problems when possible", () => {
  const session = generateDailySession(
    [
      attempt({
        problemId: "valid-anagram",
        correctPatternId: "arrays-hashing",
        createdAt: now.toISOString(),
      }),
    ],
    "arrays-hashing",
    { now },
  );

  const focusedStep = session.steps.find(
    (step) => step.type === "Focused Problem",
  );

  assert.ok(focusedStep?.problem);
  assert.notEqual(focusedStep?.problem?.id, "valid-anagram");
});
