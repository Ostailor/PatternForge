import { getPatternById } from "@/data/patterns";
import { problems } from "@/data/problems";
import type { Pattern, Problem } from "@/lib/types";

export type ContrastDrillPattern = Pick<
  Pattern,
  "id" | "name" | "recognitionClues" | "commonMistakes"
>;

export type ContrastDrillCard = {
  id: string;
  problemId: string;
  title: string;
  difficulty: Problem["difficulty"];
  recognitionClues: string[];
  url: string;
  prompt: string;
  correctPatternId: string;
};

export type ContrastDrillAnswer = {
  cardId: string;
  selectedPatternId: string;
};

export type ContrastDrillSummary = {
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  missedClues: string[];
  recommendedNextAction: string;
};

export type ContrastDrill = {
  selectedPatternId: string;
  correctPatternId: string;
  patternA: ContrastDrillPattern;
  patternB: ContrastDrillPattern;
  whyUsersConfuseThem: string;
  keyDifferences: string[];
  cards: ContrastDrillCard[];
  summarizeAnswers(answers: ContrastDrillAnswer[]): ContrastDrillSummary;
};

export type ContrastDrillData = Omit<ContrastDrill, "summarizeAnswers">;

const MAX_CARDS = 5;
const MIN_CARDS = 3;

const difficultyRank: Record<Problem["difficulty"], number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

function toDrillPattern(pattern: Pattern): ContrastDrillPattern {
  return {
    id: pattern.id,
    name: pattern.name,
    recognitionClues: pattern.recognitionClues,
    commonMistakes: pattern.commonMistakes,
  };
}

function hasPattern(problem: Problem, patternId: string): boolean {
  return (
    problem.primaryPatternId === patternId ||
    problem.secondaryPatternIds.includes(patternId)
  );
}

function getKeyDifferences(patternA: Pattern, patternB: Pattern): string[] {
  const ids = new Set([patternA.id, patternB.id]);

  if (ids.has("sliding-window") && ids.has("two-pointers")) {
    return [
      "Sliding Window maintains a changing contiguous range around a constraint.",
      "Two Pointers usually moves indices through sorted data, toward each other, or at different speeds.",
      "Ask whether the state is a window invariant or a pointer movement rule.",
    ];
  }

  if (ids.has("tree-bfs") && ids.has("tree-dfs")) {
    return [
      "BFS preserves level order with a queue.",
      "DFS follows one branch deeply before backtracking.",
      "Ask whether the answer depends on nearest level or exhaustive subtree structure.",
    ];
  }

  if (ids.has("heap-priority-queue")) {
    return [
      "Heap / Priority Queue keeps a dynamic best candidate available repeatedly.",
      "A fixed ordering approach is better when the data can be sorted once.",
      "Ask whether priorities change while processing.",
    ];
  }

  return [
    `${patternA.name} is driven by: ${patternA.recognitionClues[0] ?? "its core invariant"}.`,
    `${patternB.name} is driven by: ${patternB.recognitionClues[0] ?? "its core invariant"}.`,
    "Choose the pattern whose invariant must stay true while the solution runs.",
  ];
}

function getConfusionExplanation(patternA: Pattern, patternB: Pattern): string {
  const ids = new Set([patternA.id, patternB.id]);

  if (ids.has("sliding-window") && ids.has("two-pointers")) {
    return "Sliding Window usually tracks a contiguous range that expands and shrinks around a constraint. Two Pointers often uses two indices moving toward each other or through sorted data.";
  }

  if (ids.has("tree-bfs") && ids.has("tree-dfs")) {
    return "BFS is often better for shortest path or level-order traversal. DFS is often better for exhaustive traversal, recursion, and connected components.";
  }

  if (ids.has("heap-priority-queue")) {
    return "Heap / Priority Queue is useful when repeatedly needing top-k or dynamic priority. Sorting is useful when order can be fixed once.";
  }

  return `${patternA.name} and ${patternB.name} share surface cues, but the deciding signal is which invariant the problem asks you to maintain. Compare the recognition clues before choosing an approach.`;
}

function sortProblemPool(problemPool: Problem[]): Problem[] {
  return problemPool.slice().sort(
    (a, b) =>
      difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
      a.estimatedMinutes - b.estimatedMinutes ||
      a.title.localeCompare(b.title),
  );
}

function buildCards(patternAId: string, patternBId: string): ContrastDrillCard[] {
  const primaryPool = sortProblemPool(
    problems.filter(
      (problem) =>
        problem.primaryPatternId === patternAId ||
        problem.primaryPatternId === patternBId,
    ),
  );
  const secondaryPool = sortProblemPool(
    problems.filter(
      (problem) =>
        !primaryPool.some((primaryProblem) => primaryProblem.id === problem.id) &&
        (hasPattern(problem, patternAId) || hasPattern(problem, patternBId)),
    ),
  );
  const combinedPool = [...primaryPool, ...secondaryPool];
  const balancedCards: ContrastDrillCard[] = [];
  const patternIds = [patternAId, patternBId];

  for (const patternId of patternIds) {
    const problem = combinedPool.find(
      (candidate) =>
        candidate.primaryPatternId === patternId &&
        !balancedCards.some((card) => card.problemId === candidate.id),
    );

    if (problem) {
      balancedCards.push(toCard(problem, patternAId, patternBId));
    }
  }

  for (const problem of combinedPool) {
    if (balancedCards.length >= MAX_CARDS) {
      break;
    }

    if (balancedCards.some((card) => card.problemId === problem.id)) {
      continue;
    }

    balancedCards.push(toCard(problem, patternAId, patternBId));
  }

  return balancedCards.slice(0, Math.max(MIN_CARDS, balancedCards.length));
}

function toCard(
  problem: Problem,
  patternAId: string,
  patternBId: string,
): ContrastDrillCard {
  const correctPatternId =
    problem.primaryPatternId === patternAId ? patternAId : patternBId;

  return {
    id: `contrast-${problem.id}`,
    problemId: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    recognitionClues: problem.recognitionClues.slice(0, 3),
    url: problem.url,
    prompt: "Which pattern best fits these metadata clues?",
    correctPatternId,
  };
}

export function summarizeContrastDrillAnswers(
  drill: ContrastDrillData,
  answers: ContrastDrillAnswer[],
): ContrastDrillSummary {
  const cardById = new Map(drill.cards.map((card) => [card.id, card]));
  const missedClueSet = new Set<string>();
  let correctCount = 0;
  let answeredCount = 0;

  for (const answer of answers) {
    const card = cardById.get(answer.cardId);

    if (!card) {
      continue;
    }

    answeredCount += 1;

    if (answer.selectedPatternId === card.correctPatternId) {
      correctCount += 1;
      continue;
    }

    for (const clue of card.recognitionClues) {
      missedClueSet.add(clue);
    }
  }

  const accuracy =
    answeredCount === 0 ? 0 : Math.round((correctCount / answeredCount) * 100);
  const lowerAccuracyAction = `Run another ${drill.patternA.name} vs ${drill.patternB.name} contrast drill, then open a focused forge for the missed side.`;
  const higherAccuracyAction = `Move into focused forge for ${
    drill.patternB.name
  } and keep checking clues before implementation.`;

  return {
    answeredCount,
    correctCount,
    accuracy,
    missedClues: Array.from(missedClueSet).slice(0, 6),
    recommendedNextAction:
      accuracy >= 80 ? higherAccuracyAction : lowerAccuracyAction,
  };
}

export function buildContrastDrill(
  selectedPatternId: string,
  correctPatternId: string,
): ContrastDrill | null {
  if (selectedPatternId === correctPatternId) {
    return null;
  }

  const selectedPattern = getPatternById(selectedPatternId);
  const correctPattern = getPatternById(correctPatternId);

  if (!selectedPattern || !correctPattern) {
    return null;
  }

  const cards = buildCards(selectedPattern.id, correctPattern.id);

  if (cards.length < MIN_CARDS) {
    return null;
  }

  const drillData: ContrastDrillData = {
    selectedPatternId: selectedPattern.id,
    correctPatternId: correctPattern.id,
    patternA: toDrillPattern(selectedPattern),
    patternB: toDrillPattern(correctPattern),
    whyUsersConfuseThem: getConfusionExplanation(selectedPattern, correctPattern),
    keyDifferences: getKeyDifferences(selectedPattern, correctPattern),
    cards,
  };

  return {
    ...drillData,
    summarizeAnswers: (answers) => summarizeContrastDrillAnswers(drillData, answers),
  };
}
