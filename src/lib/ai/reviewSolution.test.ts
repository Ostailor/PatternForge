import assert from "node:assert/strict";
import test from "node:test";

import { AIResponseParseError } from "@/lib/ai/errors";
import { parseAIReviewOutput } from "@/lib/ai/reviewParsing";

const validReview = {
  patternScore: 8,
  implementationScore: 7,
  complexityScore: 6,
  explanationScore: 9,
  feedbackSummary: "You recognized the main shape and explained the tradeoff.",
  strengths: ["Good pattern recognition"],
  weaknesses: ["Tighten the edge-case explanation"],
  complexityFeedback: "State time and space complexity explicitly.",
  suggestedMistakes: [
    {
      mistakeType: "complexity",
      description: "Complexity was not stated clearly.",
      correction: "Name the dominant loop and auxiliary storage.",
    },
  ],
  suggestedFlashcards: [
    {
      front: "When does this pattern fit?",
      back: "When keyed lookup replaces repeated scanning.",
    },
  ],
  suggestedNextStep: "Practice one related problem and explain complexity aloud.",
};

test("parses AI review scores on the 1-10 scale", () => {
  assert.equal(parseAIReviewOutput(validReview).patternScore, 8);
});

test("rejects AI review scores outside the 1-10 scale", () => {
  assert.throws(
    () => parseAIReviewOutput({ ...validReview, patternScore: 0 }),
    AIResponseParseError,
  );
  assert.throws(
    () => parseAIReviewOutput({ ...validReview, patternScore: 11 }),
    AIResponseParseError,
  );
});

test("rejects malformed AI review output with controlled errors", () => {
  assert.throws(
    () => parseAIReviewOutput({ ...validReview, feedbackSummary: "" }),
    AIResponseParseError,
  );
  assert.throws(
    () => parseAIReviewOutput({ ...validReview, strengths: "clear code" }),
    AIResponseParseError,
  );
  assert.throws(
    () =>
      parseAIReviewOutput({
        ...validReview,
        suggestedMistakes: [{ mistakeType: "complexity" }],
      }),
    AIResponseParseError,
  );
  assert.throws(
    () =>
      parseAIReviewOutput({
        ...validReview,
        suggestedFlashcards: [{ front: "When use hashing?" }],
      }),
    AIResponseParseError,
  );
});
