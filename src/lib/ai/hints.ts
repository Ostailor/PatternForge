import type { AIHintOutput, HintLevel } from "@/lib/ai/types";

export const HINT_LEVELS = [
  "Pattern clue",
  "Key invariant or data structure",
  "Pointer/recurrence/state transition guidance",
  "Edge case or common pitfall",
  "High-level pseudocode",
] as const;

export function buildFallbackHints(input: {
  patternName: string;
  secondaryPatternNames: string[];
  recognitionClues: string[];
  commonMistakes: string[];
}): AIHintOutput {
  const secondaryPatterns =
    input.secondaryPatternNames.length > 0
      ? ` Related patterns to keep in mind: ${input.secondaryPatternNames.join(", ")}.`
      : "";
  const firstClue =
    input.recognitionClues[0] ??
    "Look for the shape of the input and the operation that repeats.";
  const secondClue =
    input.recognitionClues[1] ??
    "Track the smallest useful state that lets each step avoid repeated work.";
  const thirdClue =
    input.recognitionClues[2] ??
    "Define what changes after processing each item, pointer move, or recursive step.";
  const pitfall =
    input.commonMistakes[0] ??
    "Check empty inputs, duplicates, boundaries, and update order before finalizing.";

  return {
    levels: [
      {
        level: 1,
        title: HINT_LEVELS[0],
        hint: `This problem is meant to train ${input.patternName}.${secondaryPatterns} Recognition clue: ${firstClue}`,
      },
      {
        level: 2,
        title: HINT_LEVELS[1],
        hint: `Keep the central invariant explicit: ${secondClue}`,
      },
      {
        level: 3,
        title: HINT_LEVELS[2],
        hint: `Before coding, state how your state changes after each step: ${thirdClue}`,
      },
      {
        level: 4,
        title: HINT_LEVELS[3],
        hint: `Watch for this common pitfall: ${pitfall}`,
      },
      {
        level: 5,
        title: HINT_LEVELS[4],
        hint: "Sketch high-level pseudocode only: initialize the needed state, scan or recurse while preserving the invariant, update the answer when the invariant is valid, then return the accumulated result.",
      },
    ] satisfies HintLevel[],
  };
}
