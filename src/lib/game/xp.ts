import type { Attempt } from "@/lib/types";

import type { BattleXpInput, ReviewXpInput, RewardXpInput } from "./types";

export function calculateAttemptXp(attempt: Attempt): number {
  return (
    5 +
    (attempt.wasPatternCorrect ? 10 : 0) +
    (attempt.solvedStatus === "Solved" ? 20 : 0) +
    (attempt.solvedStatus === "Partially Solved" ? 10 : 0) +
    (attempt.reflection.trim().length > 50 ? 5 : 0)
  );
}

export function calculateReviewXp(review: ReviewXpInput): number {
  return (
    (review.itemType === "Flashcard" ? 5 : 0) +
    (review.itemType === "Mistake" ? 5 : 0) +
    (review.rating === "Good" ? 5 : 0) +
    (review.rating === "Easy" ? 10 : 0)
  );
}

export function calculateBattleXp({
  result,
  correctRecognitionCount,
  solvedProblemCount,
  partiallySolvedProblemCount = 0,
}: BattleXpInput): number {
  return (
    25 +
    (result === "Victory" ? 50 : 0) +
    (result === "PartialVictory" ? 25 : 0) +
    correctRecognitionCount * 10 +
    solvedProblemCount * 15 +
    partiallySolvedProblemCount * 8
  );
}

export function calculateQuestXp({ xpReward }: RewardXpInput): number {
  return xpReward;
}

export function calculateAchievementXp({ xpReward }: RewardXpInput): number {
  return xpReward;
}
