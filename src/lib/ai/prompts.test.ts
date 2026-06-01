import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGenerateHintsMessages,
  buildReviewSolutionMessages,
} from "@/lib/ai/prompts";
import type { AIHintInput, AIReviewInput } from "@/lib/ai/types";

const reviewInput: AIReviewInput = {
  problemTitle: "Two Sum",
  difficulty: "Easy",
  patternName: "Arrays & Hashing",
  secondaryPatternNames: [],
  recognitionClues: ["Complement lookup"],
  commonMistakes: ["Checking after inserting the current value"],
  userSelectedPattern: "Two Pointers",
  wasPatternCorrect: false,
  solvedStatus: "Partially Solved",
  timeSpentMinutes: 22,
  confidence: 3,
  reflection: "I tried sorting first.",
  userCode: "",
  userExplanation: "I moved pointers after sorting.",
};

test("review prompt frames AI Coach as a pattern tutor", () => {
  const prompt = buildReviewSolutionMessages(reviewInput)
    .map((message) => message.content)
    .join("\n");

  assert.match(prompt, /coding interview pattern tutor/i);
  assert.match(prompt, /time complexity/i);
  assert.match(prompt, /space complexity/i);
  assert.match(prompt, /selected the wrong pattern/i);
  assert.match(prompt, /flashcards/i);
  assert.match(prompt, /Do not include.*LeetCode problem statements/i);
});

test("hint prompt asks for a five-level ladder without full code", () => {
  const hintInput: AIHintInput = {
    problemTitle: reviewInput.problemTitle,
    difficulty: reviewInput.difficulty,
    patternName: reviewInput.patternName,
    secondaryPatternNames: reviewInput.secondaryPatternNames,
    recognitionClues: reviewInput.recognitionClues,
    commonMistakes: reviewInput.commonMistakes,
  };
  const prompt = buildGenerateHintsMessages(hintInput)
    .map((message) => message.content)
    .join("\n");

  assert.match(prompt, /five-level hint ladder/i);
  assert.match(prompt, /Pattern clue/i);
  assert.match(prompt, /Key invariant or data structure/i);
  assert.match(prompt, /High-level pseudocode/i);
  assert.match(prompt, /must not include runnable code/i);
  assert.match(prompt, /Use only.*PatternForge metadata/i);
});
