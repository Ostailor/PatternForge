import type { Difficulty, RubricCategory } from "@/generated/prisma/enums";

export type ReadinessTier = "Low" | "Medium" | "High";

export const RUBRIC_CATEGORY_WEIGHTS: Record<RubricCategory, number> = {
  Communication: 15,
  PatternRecognition: 15,
  ProblemSolving: 20,
  Implementation: 20,
  Testing: 10,
  Complexity: 10,
  TimeManagement: 10,
};

export function clampInterviewScore(score: number): number {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function getReadinessTier(readinessScore: number): ReadinessTier {
  if (readinessScore >= 70) {
    return "High";
  }

  if (readinessScore >= 45) {
    return "Medium";
  }

  return "Low";
}

export function getDifficultyOrderForReadiness(
  readinessScore: number,
  explicitTarget?: Difficulty,
): Difficulty[] {
  const baseOrder: Record<ReadinessTier, Difficulty[]> = {
    Low: ["Easy", "Medium", "Hard"],
    Medium: ["Medium", "Easy", "Hard"],
    High: ["Medium", "Hard", "Easy"],
  };
  const order = baseOrder[getReadinessTier(readinessScore)];

  if (!explicitTarget) {
    return order;
  }

  return [explicitTarget, ...order.filter((difficulty) => difficulty !== explicitTarget)];
}

export function calculateOverallRubricScore(
  scores: Partial<Record<RubricCategory, number>>,
): number {
  const totalWeight = Object.values(RUBRIC_CATEGORY_WEIGHTS).reduce(
    (total, weight) => total + weight,
    0,
  );
  const weightedScore = Object.entries(RUBRIC_CATEGORY_WEIGHTS).reduce(
    (total, [category, weight]) =>
      total + clampInterviewScore(scores[category as RubricCategory] ?? 0) * weight,
    0,
  );

  return clampInterviewScore(weightedScore / totalWeight);
}

