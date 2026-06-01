import type {
  BattleType,
  Difficulty,
  RoundType,
  SolvedStatus,
} from "@/generated/prisma/enums";

export type BattleProblemCandidate = {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  recognitionClues: string[];
  commonMistakes: string[];
  primaryPatternId: string;
  secondaryPatternIds: string[];
};

export type BattleUserAttempt = {
  problemId: string;
  correctPatternId: string;
  wasPatternCorrect: boolean;
  solvedStatus: SolvedStatus | "Partially Solved" | "Not Solved";
  confidence: number;
  createdAt: Date | string;
};

export type BattleRoundConfig = {
  problemId: string;
  roundNumber: number;
  roundType: RoundType;
  expectedPatternId: string;
};

export type BattleConfig = {
  battleType: BattleType;
  title: string;
  targetPatternId?: string;
  rounds: BattleRoundConfig[];
};

export type PublicBattleProblemMetadata = {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  recognitionClues: string[];
  commonMistakes: string[];
};

export type CreatedBattleRound = {
  id: string;
  battleId: string;
  roundNumber: number;
  roundType: RoundType;
  attemptId: string | null;
  completedAt: string | null;
  problem: PublicBattleProblemMetadata;
};

export type CreatedBattle = {
  id: string;
  battleType: BattleType;
  title: string;
  targetPatternId: string | null;
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalRounds: number;
  xpEarned: number;
  result: string | null;
  rounds: CreatedBattleRound[];
};
