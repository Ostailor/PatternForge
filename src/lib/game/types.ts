import type {
  BattleResult,
  GameEventType,
  ReviewItemType,
  ReviewRating,
} from "@/generated/prisma/enums";

export type { GameEventType };

export type GameEventMetadataValue =
  | string
  | number
  | boolean
  | null
  | GameEventMetadata
  | GameEventMetadataValue[];

export interface GameEventMetadata {
  [key: string]: GameEventMetadataValue;
}

export type ReviewXpInput = {
  itemType: ReviewItemType;
  rating: ReviewRating;
};

export type BattleXpInput = {
  result: BattleResult;
  correctRecognitionCount: number;
  solvedProblemCount: number;
  partiallySolvedProblemCount?: number;
};

export type RewardXpInput = {
  xpReward: number;
};

export type XPBreakdown = Record<GameEventType, number> & {
  total: number;
};
