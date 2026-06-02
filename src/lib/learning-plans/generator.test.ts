import assert from "node:assert/strict";
import test from "node:test";

import { generateLearningPlanDraft } from "@/lib/learning-plans/generator";
import type { LearningPlanGenerationInput } from "@/lib/learning-plans/types";

const startDate = new Date("2026-06-01T12:00:00.000Z");

function baseInput(
  overrides: Partial<LearningPlanGenerationInput> = {},
): LearningPlanGenerationInput {
  return {
    planType: "InterviewPrepSprint",
    startDate,
    patternMetrics: [],
    confusions: [],
    userMetrics: {
      totalAttempts: 0,
      totalSolved: 0,
      overallRecognitionAccuracy: 0,
      overallRetentionScore: null,
      totalReviews: 0,
      totalMistakes: 0,
      totalFlashcards: 0,
      battleWinRate: 0,
      currentStreak: 0,
      totalXP: 0,
      strongestPattern: null,
      weakestPattern: null,
      mostConfusedPatternPair: null,
    },
    ...overrides,
  };
}

test("new users get a beginner-friendly interview prep sprint", () => {
  const plan = generateLearningPlanDraft(baseInput());

  assert.equal(plan.title, "14-Day Interview Prep Sprint");
  assert.equal(plan.steps.length, 14);
  assert.equal(plan.steps[0].stepType, "FocusProblem");
  assert.equal(plan.steps[0].targetPatternId, "arrays-hashing");
  assert.equal(plan.steps[1].targetPatternId, "two-pointers");
  assert.equal(plan.endDate?.toISOString(), "2026-06-14T12:00:00.000Z");
});

test("weak retention inserts more review steps", () => {
  const plan = generateLearningPlanDraft(
    baseInput({
      planType: "MaintenanceMode",
      userMetrics: {
        ...baseInput().userMetrics,
        totalAttempts: 12,
        overallRetentionScore: 48,
      },
    }),
  );

  const reviewSteps = plan.steps.filter((step) => step.stepType === "Review");

  assert.ok(reviewSteps.length >= 3);
  assert.ok(plan.goal.toLowerCase().includes("retention"));
});

test("confusion pairs add contrast drills to weakness repair", () => {
  const plan = generateLearningPlanDraft(
    baseInput({
      planType: "WeaknessRepair",
      userMetrics: {
        ...baseInput().userMetrics,
        totalAttempts: 10,
      },
      confusions: [
        {
          selectedPatternId: "two-pointers",
          correctPatternId: "sliding-window",
          count: 4,
          lastSeenAt: "2026-05-31T00:00:00.000Z",
          selectedPatternName: "Two Pointers",
          correctPatternName: "Sliding Window",
        },
      ],
    }),
  );

  const contrastStep = plan.steps.find((step) => step.stepType === "ContrastDrill");

  assert.ok(contrastStep);
  assert.equal(contrastStep?.targetPatternId, "sliding-window");
  assert.match(contrastStep?.title ?? "", /Two Pointers vs Sliding Window/);
});

test("high mastery adds boss battles", () => {
  const plan = generateLearningPlanDraft(
    baseInput({
      planType: "InterviewPrepSprint",
      patternMetrics: [
        {
          patternId: "binary-search",
          patternName: "Binary Search",
          attemptsCount: 5,
          solvedCount: 5,
          partiallySolvedCount: 0,
          notSolvedCount: 0,
          solveRate: 100,
          recognitionAttempts: 5,
          recognitionCorrect: 5,
          recognitionAccuracy: 100,
          averageConfidence: 4,
          averageAIScore: null,
          mistakeCount: 0,
          flashcardCount: 0,
          reviewCount: 3,
          reviewRatingAverage: 90,
          lapseCount: 0,
          retentionScore: 88,
          battleCount: 0,
          battleVictoryCount: 0,
          lastPracticedAt: "2026-05-31T00:00:00.000Z",
          daysSincePractice: 1,
          masteryScore: 84,
        },
      ],
      userMetrics: {
        ...baseInput().userMetrics,
        totalAttempts: 10,
      },
    }),
  );

  const bossBattle = plan.steps.find((step) => step.stepType === "BossBattle");

  assert.ok(bossBattle);
  assert.equal(bossBattle?.targetPatternId, "binary-search");
});

test("master a pattern focuses every practice step on the selected pattern", () => {
  const plan = generateLearningPlanDraft(
    baseInput({
      planType: "MasterPattern",
      targetPatternId: "stack",
      userMetrics: {
        ...baseInput().userMetrics,
        totalAttempts: 6,
      },
    }),
  );

  assert.match(plan.title, /Stack/);
  assert.ok(
    plan.steps
      .filter((step) => step.stepType === "FocusProblem")
      .every((step) => step.targetPatternId === "stack"),
  );
});
