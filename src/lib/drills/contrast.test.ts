import assert from "node:assert/strict";
import test from "node:test";

import { buildContrastDrill } from "@/lib/drills/contrast";

test("builds a sliding window vs two pointers drill from seeded metadata", () => {
  const drill = buildContrastDrill("two-pointers", "sliding-window");

  assert.ok(drill);
  assert.equal(drill.patternA.name, "Two Pointers");
  assert.equal(drill.patternB.name, "Sliding Window");
  assert.match(drill.whyUsersConfuseThem, /contiguous range/i);
  assert.ok(drill.keyDifferences.length >= 2);
  assert.ok(drill.cards.length >= 3);
  assert.ok(drill.cards.length <= 5);
  assert.ok(
    drill.cards.every((card) =>
      ["two-pointers", "sliding-window"].includes(card.correctPatternId),
    ),
  );
});

test("does not reveal correct pattern names in quiz card prompts", () => {
  const drill = buildContrastDrill("two-pointers", "sliding-window");

  assert.ok(drill);
  assert.ok(
    drill.cards.every(
      (card) =>
        !card.prompt.toLowerCase().includes("sliding window") &&
        !card.prompt.toLowerCase().includes("two pointers"),
    ),
  );
});

test("returns null for invalid or identical pattern pairs", () => {
  assert.equal(buildContrastDrill("missing", "sliding-window"), null);
  assert.equal(buildContrastDrill("two-pointers", "two-pointers"), null);
});

test("summarizes missed clues and next action from answers", () => {
  const drill = buildContrastDrill("two-pointers", "sliding-window");

  assert.ok(drill);

  const summary = drill.summarizeAnswers([
    {
      cardId: drill.cards[0].id,
      selectedPatternId: drill.cards[0].correctPatternId,
    },
    {
      cardId: drill.cards[1].id,
      selectedPatternId:
        drill.cards[1].correctPatternId === "two-pointers"
          ? "sliding-window"
          : "two-pointers",
    },
  ]);

  assert.equal(summary.answeredCount, 2);
  assert.equal(summary.correctCount, 1);
  assert.equal(summary.accuracy, 50);
  assert.ok(summary.missedClues.length > 0);
  assert.match(summary.recommendedNextAction, /focused forge|contrast/i);
});
