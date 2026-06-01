import assert from "node:assert/strict";
import test from "node:test";

import {
  DAILY_AI_REVIEW_LIMIT,
  getDailyReviewWindow,
} from "@/lib/ai-review-limits";

test("daily AI review limit is intentionally small for v0.2", () => {
  assert.equal(DAILY_AI_REVIEW_LIMIT, 5);
});

test("daily AI review window is one UTC day", () => {
  const { start, end } = getDailyReviewWindow(
    new Date("2026-06-01T18:35:12.000Z"),
  );

  assert.equal(start.toISOString(), "2026-06-01T00:00:00.000Z");
  assert.equal(end.toISOString(), "2026-06-02T00:00:00.000Z");
});
