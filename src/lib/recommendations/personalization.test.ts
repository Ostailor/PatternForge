import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRecommendationFeedbackPersonalization,
  deriveRecommendationFeedbackProfile,
  getDifficultyPreferenceForRecommendation,
} from "@/lib/recommendations/personalization";
import type { RecommendationCandidate } from "@/lib/recommendations/types";

function candidate(
  overrides: Partial<RecommendationCandidate> = {},
): RecommendationCandidate {
  return {
    title: "Focus Sliding Window",
    reason: "Solve rate is low.",
    priority: 3,
    recommendationType: "FocusPattern",
    targetPatternId: "sliding-window",
    metadata: {},
    evidence: ["Solve rate: 40%"],
    ...overrides,
  };
}

test("too easy feedback nudges similar future recommendations harder", () => {
  const profile = deriveRecommendationFeedbackProfile([
    {
      feedbackType: "TooEasy",
      recommendationType: "FocusPattern",
      targetPatternId: "sliding-window",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
    },
  ]);

  assert.equal(
    getDifficultyPreferenceForRecommendation(
      profile,
      "FocusPattern",
      "sliding-window",
    ),
    "harder",
  );

  const [personalized] = applyRecommendationFeedbackPersonalization(
    [candidate()],
    profile,
  );

  assert.equal(personalized.metadata.difficultyPreference, "harder");
  assert.match(personalized.reason, /nudges difficulty up/);
});

test("too hard feedback nudges similar future recommendations easier with review first", () => {
  const profile = deriveRecommendationFeedbackProfile([
    {
      feedbackType: "TooHard",
      recommendationType: "RetryProblem",
      targetPatternId: "binary-search",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
    },
  ]);

  const [personalized] = applyRecommendationFeedbackPersonalization(
    [
      candidate({
        recommendationType: "RetryProblem",
        targetPatternId: "binary-search",
      }),
    ],
    profile,
  );

  assert.equal(personalized.metadata.difficultyPreference, "easier");
  assert.equal(personalized.metadata.recommendReviewFirst, true);
  assert.match(personalized.reason, /favors review first/);
});

test("not relevant suppresses the same recommendation type until newer feedback allows it", () => {
  const suppressedProfile = deriveRecommendationFeedbackProfile([
    {
      feedbackType: "NotRelevant",
      recommendationType: "ContrastDrill",
      targetPatternId: "sliding-window",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
    },
  ]);

  assert.deepEqual(
    applyRecommendationFeedbackPersonalization(
      [candidate({ recommendationType: "ContrastDrill" })],
      suppressedProfile,
    ),
    [],
  );

  const allowedProfile = deriveRecommendationFeedbackProfile([
    {
      feedbackType: "NotRelevant",
      recommendationType: "ContrastDrill",
      targetPatternId: "sliding-window",
      createdAt: new Date("2026-05-31T12:00:00.000Z"),
    },
    {
      feedbackType: "Helpful",
      recommendationType: "ContrastDrill",
      targetPatternId: "two-pointers",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
    },
  ]);

  assert.equal(
    applyRecommendationFeedbackPersonalization(
      [candidate({ recommendationType: "ContrastDrill" })],
      allowedProfile,
    ).length,
    1,
  );
});
