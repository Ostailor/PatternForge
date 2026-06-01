import type { QuestStatus } from "@/generated/prisma/enums";
import type { ReviewItemType } from "@/lib/review/types";
import type { SolvedStatus } from "@/lib/types";

export const dailyQuestTypes = [
  "CompleteAttempt",
  "ReviewFlashcards",
  "ReviewMistake",
  "CompleteBossBattle",
  "CorrectPatterns",
  "PracticeWeakestPattern",
  "CompleteDueReviews",
] as const;

export type DailyQuestType = (typeof dailyQuestTypes)[number];

export type DailyQuest = {
  id: string;
  questType: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  xpReward: number;
  status: QuestStatus;
  date: string;
  completedAt: string | null;
};

export type QuestProgressEvent =
  | {
      eventType: "AttemptCompleted";
      attemptId: string;
      correctPatternId: string;
      wasPatternCorrect: boolean;
      solvedStatus: SolvedStatus;
    }
  | {
      eventType: "ReviewCompleted";
      reviewLogId: string;
      itemType: ReviewItemType;
    }
  | {
      eventType: "BattleCompleted";
      battleId: string;
    };
