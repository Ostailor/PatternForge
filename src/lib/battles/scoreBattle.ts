import type { BattleResult } from "@/generated/prisma/enums";
import { calculateBattleXp } from "@/lib/game/xp";

export type BattleScoringRound = {
  wasPatternCorrect: boolean;
  solvedStatus: string;
};

export type BattleScore = {
  result: BattleResult;
  recognitionAccuracy: number;
  solvedRoundCount: number;
  partiallySolvedRoundCount: number;
  correctRecognitionCount: number;
  completedOrPartialCount: number;
  xpEarned: number;
};

function isSolved(solvedStatus: string): boolean {
  return solvedStatus === "Solved";
}

function isPartiallySolved(solvedStatus: string): boolean {
  return (
    solvedStatus === "Partially Solved" || solvedStatus === "PartiallySolved"
  );
}

function getRatio(count: number, total: number): number {
  return total === 0 ? 0 : count / total;
}

export function scoreBattle(rounds: BattleScoringRound[]): BattleScore {
  const totalRounds = rounds.length;
  const correctRecognitionCount = rounds.filter(
    (round) => round.wasPatternCorrect,
  ).length;
  const solvedRoundCount = rounds.filter((round) =>
    isSolved(round.solvedStatus),
  ).length;
  const partiallySolvedRoundCount = rounds.filter((round) =>
    isPartiallySolved(round.solvedStatus),
  ).length;
  const completedOrPartialCount = solvedRoundCount + partiallySolvedRoundCount;
  const recognitionAccuracy = getRatio(correctRecognitionCount, totalRounds);
  const solveCompletionRate = getRatio(completedOrPartialCount, totalRounds);
  const result: BattleResult =
    recognitionAccuracy >= 0.8 && solveCompletionRate >= 0.8
      ? "Victory"
      : recognitionAccuracy >= 0.5 || solveCompletionRate >= 0.5
        ? "PartialVictory"
        : "Defeat";

  return {
    result,
    recognitionAccuracy,
    solvedRoundCount,
    partiallySolvedRoundCount,
    correctRecognitionCount,
    completedOrPartialCount,
    xpEarned: calculateBattleXp({
      result,
      correctRecognitionCount,
      solvedProblemCount: solvedRoundCount,
      partiallySolvedProblemCount: partiallySolvedRoundCount,
    }),
  };
}
