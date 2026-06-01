import assert from "node:assert/strict";
import test from "node:test";

import { buildFallbackHints, HINT_LEVELS } from "@/lib/ai/hints";

test("fallback hints produce the fixed five-level ladder", () => {
  const hints = buildFallbackHints({
    patternName: "Arrays & Hashing",
    secondaryPatternNames: ["Heap / Priority Queue"],
    recognitionClues: ["Complement lookup", "Single pass map"],
    commonMistakes: ["Checking after inserting the current value"],
  });

  assert.equal(hints.levels.length, 5);
  assert.deepEqual(
    hints.levels.map((hint) => hint.title),
    [...HINT_LEVELS],
  );
  assert.equal(hints.levels[0].level, 1);
  assert.match(hints.levels[0].hint, /Arrays & Hashing/);
  assert.match(hints.levels[4].hint, /pseudocode/i);
  assert.doesNotMatch(hints.levels[4].hint, /function|class|return \[/i);
});
