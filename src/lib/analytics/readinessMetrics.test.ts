import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateReadinessScoreBreakdown,
  getInterviewReadinessLabel,
} from "@/lib/analytics/readinessScoring";
import type { PatternMetric } from "@/lib/analytics/types";

function patternMetric(
  overrides: Partial<PatternMetric> = {},
): PatternMetric {
  return {
    patternId: "sliding-window",
    patternName: "Sliding Window",
    attemptsCount: 4,
    solvedCount: 3,
    partiallySolvedCount: 1,
    notSolvedCount: 0,
    solveRate: 75,
    recognitionAttempts: 4,
    recognitionCorrect: 3,
    recognitionAccuracy: 75,
    averageConfidence: 4,
    averageAIScore: null,
    mistakeCount: 1,
    flashcardCount: 1,
    reviewCount: 2,
    reviewRatingAverage: 80,
    lapseCount: 0,
    retentionScore: 80,
    battleCount: 1,
    battleVictoryCount: 1,
    lastPracticedAt: "2026-06-01T12:00:00.000Z",
    daysSincePractice: 0,
    masteryScore: 78,
    ...overrides,
  };
}

test("maps readiness scores to requested readiness labels", () => {
  assert.equal(getInterviewReadinessLabel(0), "Just Starting");
  assert.equal(getInterviewReadinessLabel(20), "Building Foundation");
  assert.equal(getInterviewReadinessLabel(45), "Pattern-Aware");
  assert.equal(getInterviewReadinessLabel(65), "Battle-Tested");
  assert.equal(getInterviewReadinessLabel(80), "Interview-Ready");
});

test("calculates readiness score categories from pattern metrics", () => {
  const scores = calculateReadinessScoreBreakdown(
    [
      patternMetric(),
      patternMetric({
        patternId: "binary-search",
        patternName: "Binary Search",
        attemptsCount: 2,
        solvedCount: 1,
        solveRate: 50,
        recognitionAccuracy: 50,
        averageConfidence: 3,
        retentionScore: 60,
        battleCount: 1,
        battleVictoryCount: 0,
        masteryScore: 45,
      }),
      patternMetric({
        patternId: "heap-priority-queue",
        patternName: "Heap / Priority Queue",
        attemptsCount: 0,
        solvedCount: 0,
        partiallySolvedCount: 0,
        solveRate: 0,
        recognitionAttempts: 0,
        recognitionCorrect: 0,
        recognitionAccuracy: 0,
        averageConfidence: null,
        mistakeCount: 0,
        flashcardCount: 0,
        reviewCount: 0,
        retentionScore: null,
        battleCount: 0,
        battleVictoryCount: 0,
        masteryScore: 0,
      }),
    ],
    [
      {
        selectedPatternId: "two-pointers",
        correctPatternId: "sliding-window",
        count: 2,
        lastSeenAt: "2026-06-01T12:00:00.000Z",
        selectedPatternName: "Two Pointers",
        correctPatternName: "Sliding Window",
      },
    ],
  );

  assert.equal(scores.patternCoverage, 67);
  assert.equal(scores.patternRecognition, 63);
  assert.equal(scores.solveConsistency, 67);
  assert.equal(scores.retention, 70);
  assert.equal(scores.bossBattlePerformance, 50);
  assert.equal(scores.interviewPerformance, 60);
  assert.equal(scores.codeExecutionDebugging, 60);
  assert.equal(scores.communication, 60);
  assert.equal(scores.confidence, 70);
});
