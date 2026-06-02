import assert from "node:assert/strict";
import test from "node:test";

import {
  getRecommendationDedupeKey,
  selectNextBestAction,
} from "@/lib/recommendations/nextBestAction";
import type { RecommendationCandidate } from "@/lib/recommendations/types";

function candidate(
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
  return {
    title: "Practice Arrays",
    reason: "Arrays need work.",
    priority: 3,
    recommendationType: "FocusPattern",
    targetPatternId: "arrays-hashing",
    metadata: {},
    evidence: ["Mastery gap: 50"],
    ...overrides,
  };
}

test("selects due review before active battle and weak pattern recommendations", () => {
  const next = selectNextBestAction([
    candidate({
      title: "Resume Battle",
      priority: 2,
      recommendationType: "BossBattle",
      battleType: "PatternBoss",
      metadata: { battleId: "battle-1", action: "resume" },
    }),
    candidate({
      title: "Daily Review",
      priority: 1,
      recommendationType: "DueReview",
      metadata: { dueCount: 5 },
    }),
    candidate({
      title: "Focus Sliding Window",
      priority: 3,
      recommendationType: "FocusPattern",
      targetPatternId: "sliding-window",
    }),
  ]);

  assert.equal(next?.title, "Daily Review");
  assert.equal(next?.recommendationType, "DueReview");
});

test("uses priority then evidence count then title for deterministic ordering", () => {
  const next = selectNextBestAction([
    candidate({
      title: "B option",
      priority: 4,
      evidence: ["confusion"],
    }),
    candidate({
      title: "A option",
      priority: 4,
      evidence: ["confusion", "count: 3"],
    }),
  ]);

  assert.equal(next?.title, "A option");
});

test("keeps interview readiness behind due review and severe weakness", () => {
  const next = selectNextBestAction([
    candidate({
      title: "Start single problem mock interview",
      priority: 4,
      recommendationType: "MockInterview",
      metadata: { interviewType: "SingleProblem" },
      evidence: ["High practice readiness"],
    }),
    candidate({
      title: "Focus Sliding Window",
      priority: 3,
      recommendationType: "FocusPattern",
      targetPatternId: "sliding-window",
    }),
    candidate({
      title: "Daily Review",
      priority: 1,
      recommendationType: "DueReview",
      metadata: { dueCount: 5 },
    }),
  ]);

  assert.equal(next?.recommendationType, "DueReview");
});

test("allows active interview resume in the active session priority tier", () => {
  const next = selectNextBestAction([
    candidate({
      title: "Start single problem mock interview",
      priority: 4,
      recommendationType: "MockInterview",
      metadata: { interviewType: "SingleProblem" },
    }),
    candidate({
      title: "Resume Mixed Interview",
      priority: 2,
      recommendationType: "MockInterview",
      metadata: { interviewId: "interview-1", action: "resume" },
      evidence: ["Active interview is available"],
    }),
  ]);

  assert.equal(next?.title, "Resume Mixed Interview");
});

test("builds a stable dedupe key from action identity fields", () => {
  assert.equal(
    getRecommendationDedupeKey(
      candidate({
        recommendationType: "ContrastDrill",
        targetPatternId: "two-pointers",
        secondaryPatternId: "sliding-window",
        problemId: "minimum-size-subarray-sum",
        battleType: undefined,
      }),
    ),
    "ContrastDrill|two-pointers|sliding-window|minimum-size-subarray-sum|none",
  );
});
