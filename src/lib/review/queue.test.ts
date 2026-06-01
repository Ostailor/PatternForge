import assert from "node:assert/strict";
import test from "node:test";

import {
  getRatingValue,
  sortReviewQueueItems,
  toRetentionScore,
  validateReviewRequest,
  type ReviewQueueItem,
} from "@/lib/review/queue";

function item(
  id: string,
  reviewDueAt: string,
  itemType: ReviewQueueItem["itemType"],
): ReviewQueueItem {
  return {
    id,
    itemType,
    patternId: "arrays-hashing",
    patternName: "Arrays & Hashing",
    problemTitle: "Two Sum",
    prompt: id,
    answer: id,
    reviewDueAt: new Date(reviewDueAt),
    lastReviewedAt: null,
    intervalDays: 0,
    easeFactor: 2.5,
    repetitions: 0,
    lapses: 0,
    status: "active",
  };
}

test("sortReviewQueueItems prioritizes earliest due mixed review items", () => {
  const sorted = sortReviewQueueItems([
    item("later", "2026-06-03T00:00:00.000Z", "Flashcard"),
    item("mistake", "2026-06-01T00:00:00.000Z", "Mistake"),
    item("flashcard", "2026-06-01T00:00:00.000Z", "Flashcard"),
  ]);

  assert.deepEqual(
    sorted.map((reviewItem) => reviewItem.id),
    ["flashcard", "mistake", "later"],
  );
});

test("validateReviewRequest rejects missing IDs and invalid ratings", () => {
  assert.throws(
    () => validateReviewRequest("", "card-1", "Good"),
    /User profile ID is required/,
  );
  assert.throws(
    () => validateReviewRequest("user-1", "", "Good"),
    /Review item ID is required/,
  );
  assert.throws(
    () => validateReviewRequest("user-1", "card-1", "Bad"),
    /Review rating is invalid/,
  );
});

test("toRetentionScore averages review ratings", () => {
  assert.equal(getRatingValue("Again"), 0);
  assert.equal(getRatingValue("Hard"), 50);
  assert.equal(getRatingValue("Good"), 85);
  assert.equal(getRatingValue("Easy"), 100);
  assert.equal(toRetentionScore(["Again", "Hard", "Good", "Easy"]), 59);
  assert.equal(toRetentionScore([]), null);
});
