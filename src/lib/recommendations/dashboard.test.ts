import assert from "node:assert/strict";
import test from "node:test";

import { toDashboardRecommendation } from "@/lib/recommendations/dashboard";
import type { SavedRecommendationForDashboard } from "@/lib/recommendations/dashboard";

function recommendation(
  overrides: Partial<SavedRecommendationForDashboard> = {},
): SavedRecommendationForDashboard {
  return {
    id: "rec-1",
    title: "Clear your due reviews",
    reason: "You have 6 flashcards and 3 mistake cards due today.",
    recommendationType: "DueReview",
    priority: 1,
    targetPatternId: undefined,
    secondaryPatternId: undefined,
    problemId: undefined,
    battleType: undefined,
    metadata: {},
    evidence: ["6 due flashcards", "3 due mistakes"],
    ...overrides,
  };
}

test("formats due review next best action with daily review CTA", () => {
  const dashboardRecommendation = toDashboardRecommendation(
    recommendation({
      metadata: {
        dueFlashcardsCount: 6,
        dueMistakesCount: 3,
        dueCount: 9,
      },
    }),
  );

  assert.equal(dashboardRecommendation.title, "Clear your due reviews");
  assert.equal(dashboardRecommendation.recommendationTypeLabel, "Due Review");
  assert.equal(dashboardRecommendation.primaryCta.label, "Start Daily Review");
  assert.equal(dashboardRecommendation.primaryCta.href, "/review");
  assert.equal(dashboardRecommendation.estimatedMinutes, 15);
  assert.deepEqual(dashboardRecommendation.evidence, [
    "6 due flashcards",
    "3 due mistakes",
  ]);
});

test("formats focus pattern action with pattern names and forge CTA", () => {
  const dashboardRecommendation = toDashboardRecommendation(
    recommendation({
      title: "Practice Sliding Window implementation",
      recommendationType: "FocusPattern",
      targetPatternId: "sliding-window",
      reason: "Your recognition is 82%, but solve rate is 43%.",
      evidence: ["Recognition accuracy: 82%", "Solve rate: 43%"],
    }),
  );

  assert.equal(dashboardRecommendation.targetPatternName, "Sliding Window");
  assert.equal(dashboardRecommendation.primaryCta.label, "Start Focused Forge");
  assert.equal(
    dashboardRecommendation.primaryCta.href,
    "/forge?pattern=sliding-window",
  );
  assert.equal(dashboardRecommendation.secondaryCta?.label, "View Pattern");
});

test("formats contrast drill with both pattern names", () => {
  const dashboardRecommendation = toDashboardRecommendation(
    recommendation({
      title: "Compare Sliding Window vs Two Pointers",
      recommendationType: "ContrastDrill",
      targetPatternId: "sliding-window",
      secondaryPatternId: "two-pointers",
      reason: "You confused these patterns 4 times.",
      metadata: { count: 4 },
      evidence: [
        "4 recorded confusions",
        "Last seen 2026-05-31T00:00:00.000Z",
      ],
    }),
  );

  assert.equal(dashboardRecommendation.targetPatternName, "Sliding Window");
  assert.equal(dashboardRecommendation.secondaryPatternName, "Two Pointers");
  assert.equal(dashboardRecommendation.primaryCta.label, "Start Contrast Drill");
  assert.equal(
    dashboardRecommendation.primaryCta.href,
    "/drills/contrast/two-pointers/sliding-window",
  );
  assert.equal(dashboardRecommendation.estimatedMinutes, 28);
});

test("formats boss battle action with battle CTA", () => {
  const dashboardRecommendation = toDashboardRecommendation(
    recommendation({
      title: "Challenge Binary Search Boss",
      recommendationType: "BossBattle",
      battleType: "PatternBoss",
      targetPatternId: "binary-search",
      reason: "Your mastery is 81% and retention is strong.",
      evidence: ["Mastery >= 76", "Retention >= 75"],
    }),
  );

  assert.equal(dashboardRecommendation.recommendationTypeLabel, "Boss Battle");
  assert.equal(dashboardRecommendation.primaryCta.label, "Start Boss Battle");
  assert.equal(dashboardRecommendation.primaryCta.href, "/battles");
  assert.deepEqual(dashboardRecommendation.feedbackOptions, [
    "Helpful",
    "TooEasy",
    "TooHard",
    "NotRelevant",
  ]);
});

test("formats interview recommendations with interview CTAs", () => {
  const mockInterview = toDashboardRecommendation(
    recommendation({
      title: "Start single problem mock interview",
      recommendationType: "MockInterview",
      priority: 4,
      reason: "Readiness is high, but no mock interviews are completed.",
      metadata: { interviewType: "SingleProblem" },
      evidence: ["High practice readiness", "No completed interviews"],
    }),
  );
  const activeInterview = toDashboardRecommendation(
    recommendation({
      title: "Resume Mixed Interview",
      recommendationType: "MockInterview",
      priority: 2,
      reason: "An active interview is already in progress.",
      metadata: { interviewId: "interview-1", action: "resume" },
      evidence: ["Active interview is available"],
    }),
  );
  const focusedInterview = toDashboardRecommendation(
    recommendation({
      title: "Start focused Sliding Window interview",
      recommendationType: "FocusedInterview",
      priority: 4,
      targetPatternId: "sliding-window",
      reason: "Sliding Window is weak enough for a focused mock.",
      metadata: { interviewType: "FocusedPattern" },
      evidence: ["Mastery 52%"],
    }),
  );
  const repairInterview = toDashboardRecommendation(
    recommendation({
      title: "Start weakness repair interview",
      recommendationType: "WeaknessRepairInterview",
      priority: 4,
      reason: "A recent boss battle exposed pressure-test gaps.",
      metadata: { interviewType: "WeaknessRepair" },
      evidence: ["Recent boss battle result: Defeat"],
    }),
  );

  assert.equal(mockInterview.recommendationTypeLabel, "Mock Interview");
  assert.equal(mockInterview.primaryCta.label, "Start Mock Interview");
  assert.equal(mockInterview.primaryCta.href, "/interviews");
  assert.equal(activeInterview.primaryCta.label, "Resume Interview");
  assert.equal(activeInterview.primaryCta.href, "/interviews/interview-1");
  assert.equal(focusedInterview.primaryCta.label, "Start Focused Interview");
  assert.equal(repairInterview.primaryCta.label, "Start Weakness Repair Interview");
});

test("formats code execution recommendations with workspace CTAs", () => {
  const debugDrill = toDashboardRecommendation(
    recommendation({
      title: "Debug Sliding Window runtime errors",
      recommendationType: "DebugDrill",
      priority: 5,
      targetPatternId: "sliding-window",
      problemId: "minimum-size-subarray-sum",
      reason: "Sliding Window has repeated runtime errors.",
      evidence: ["2 runtime error runs"],
    }),
  );
  const testingPractice = toDashboardRecommendation(
    recommendation({
      title: "Practice writing custom tests",
      recommendationType: "TestingPractice",
      priority: 6,
      problemId: "two-sum",
      reason: "Custom-test count is low.",
      evidence: ["0.5 average tests per run"],
    }),
  );
  const implementationPractice = toDashboardRecommendation(
    recommendation({
      title: "Implementation practice: Binary Search",
      recommendationType: "ImplementationPractice",
      priority: 5,
      targetPatternId: "binary-search",
      reason: "Recognition is strong, but custom test runs are failing.",
      evidence: ["2 failed custom-test runs"],
    }),
  );

  assert.equal(debugDrill.recommendationTypeLabel, "Debug Drill");
  assert.equal(debugDrill.primaryCta.label, "Open Workspace");
  assert.equal(
    debugDrill.primaryCta.href,
    "/problems/minimum-size-subarray-sum/workspace?mode=Practice",
  );
  assert.equal(debugDrill.secondaryCta?.label, "Code History");
  assert.equal(testingPractice.recommendationTypeLabel, "Testing Practice");
  assert.equal(testingPractice.primaryCta.label, "Write Custom Tests");
  assert.equal(implementationPractice.recommendationTypeLabel, "Implementation Practice");
  assert.equal(
    implementationPractice.primaryCta.href,
    "/forge?pattern=binary-search",
  );
});
