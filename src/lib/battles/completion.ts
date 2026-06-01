import { scoreBattle } from "@/lib/battles/scoreBattle";

type BattleCompletionRound = {
  wasPatternCorrect: boolean;
  solvedStatus: string;
};

export type BattleCompletionSummary = {
  result: ReturnType<typeof scoreBattle>["result"];
  correctRecognitionCount: number;
  solvedProblemCount: number;
  partiallySolvedProblemCount: number;
  xpEarned: number;
};

export function summarizeBattleCompletion(
  rounds: BattleCompletionRound[],
): BattleCompletionSummary {
  const score = scoreBattle(rounds);

  return {
    result: score.result,
    correctRecognitionCount: score.correctRecognitionCount,
    solvedProblemCount: score.solvedRoundCount,
    partiallySolvedProblemCount: score.partiallySolvedRoundCount,
    xpEarned: score.xpEarned,
  };
}
