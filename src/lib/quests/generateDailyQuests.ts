import { patterns } from "@/data/patterns";
import { getPatternProgress } from "@/lib/mastery";
import { getPrisma } from "@/lib/prisma";
import { progressFromAttempts } from "@/lib/progress";
import { toAppAttempt } from "@/lib/progress-db";
import type { DailyQuest } from "@/lib/quests/types";
import { syncDailyQuestProgress } from "@/lib/quests/updateQuestProgress";

const MAX_DAILY_QUESTS = 3;

type QuestTemplate = {
  questType: string;
  title: string;
  description: string;
  targetCount: number;
  xpReward: number;
};

function getUtcDayWindow(now = new Date()) {
  const start = new Date(now);

  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function toDailyQuest(quest: {
  id: string;
  questType: string;
  title: string;
  description: string;
  targetCount: number;
  currentCount: number;
  xpReward: number;
  status: DailyQuest["status"];
  date: Date;
  completedAt: Date | null;
}): DailyQuest {
  return {
    id: quest.id,
    questType: quest.questType,
    title: quest.title,
    description: quest.description,
    targetCount: quest.targetCount,
    currentCount: quest.currentCount,
    xpReward: quest.xpReward,
    status: quest.status,
    date: quest.date.toISOString(),
    completedAt: quest.completedAt?.toISOString() ?? null,
  };
}

function findWeakestPatternId(attempts: ReturnType<typeof toAppAttempt>[]) {
  const progress = progressFromAttempts(attempts);

  return patterns
    .map((pattern) => ({
      pattern,
      progress: getPatternProgress(pattern.id, progress),
    }))
    .filter((row) => row.progress.attemptedCount > 0)
    .sort(
      (a, b) =>
        a.progress.masteryScore - b.progress.masteryScore ||
        b.progress.attemptedCount - a.progress.attemptedCount ||
        a.pattern.levelOrder - b.pattern.levelOrder,
    )[0]?.pattern.id;
}

async function buildQuestTemplates(
  userProfileId: string,
): Promise<QuestTemplate[]> {
  const prisma = getPrisma();
  const [attempts, dueFlashcardsCount, dueMistakesCount, completedBattlesCount] =
    await Promise.all([
      prisma.attempt.findMany({
        where: { userProfileId },
        orderBy: { createdAt: "asc" },
      }),
      prisma.flashcard.count({
        where: {
          userProfileId,
          status: "active",
          reviewDueAt: {
            lte: new Date(),
          },
        },
      }),
      prisma.mistake.count({
        where: {
          userProfileId,
          status: "active",
          reviewDueAt: {
            lte: new Date(),
          },
        },
      }),
      prisma.battle.count({
        where: {
          userProfileId,
          status: "Completed",
        },
      }),
    ]);
  const appAttempts = attempts.map(toAppAttempt);
  const weakestPatternId = findWeakestPatternId(appAttempts);
  const weakestPattern = patterns.find((pattern) => pattern.id === weakestPatternId);
  const templates: QuestTemplate[] = [
    {
      questType: "CompleteAttempt",
      title: "Complete 1 problem attempt",
      description: "Save one practice reflection from Daily Forge or a battle.",
      targetCount: 1,
      xpReward: 20,
    },
    {
      questType: "CorrectPatterns",
      title: "Correctly recognize 2 patterns",
      description: "Choose the right pattern before solving.",
      targetCount: 2,
      xpReward: 35,
    },
  ];

  if (attempts.length === 0) {
    return templates.slice(0, MAX_DAILY_QUESTS);
  }

  if (weakestPattern) {
    templates.push({
      questType: `PracticeWeakestPattern:${weakestPattern.id}`,
      title: `Practice ${weakestPattern.name}`,
      description: "Train the pattern that currently needs the most reps.",
      targetCount: 1,
      xpReward: 30,
    });
  }

  if (dueFlashcardsCount >= 3) {
    templates.push({
      questType: "ReviewFlashcards",
      title: "Review 3 flashcards",
      description: "Clear three memory cards from your review queue.",
      targetCount: 3,
      xpReward: 35,
    });
  }

  if (dueMistakesCount >= 1) {
    templates.push({
      questType: "ReviewMistake",
      title: "Review 1 mistake",
      description: "Revisit one saved mistake and update its review schedule.",
      targetCount: 1,
      xpReward: 30,
    });
  }

  if (dueFlashcardsCount + dueMistakesCount > 0) {
    templates.push({
      questType: "CompleteDueReviews",
      title: "Complete all due reviews",
      description: "Empty today's flashcard and mistake review queue.",
      targetCount: 1,
      xpReward: 50,
    });
  }

  if (attempts.length >= 3 || completedBattlesCount > 0) {
    templates.push({
      questType: "CompleteBossBattle",
      title: "Complete 1 Boss Battle",
      description: "Finish any active boss battle or start a new one.",
      targetCount: 1,
      xpReward: 75,
    });
  }

  return templates.slice(0, MAX_DAILY_QUESTS);
}

export async function generateDailyQuests(
  userProfileId: string,
  now = new Date(),
): Promise<DailyQuest[]> {
  const prisma = getPrisma();
  const { start, end } = getUtcDayWindow(now);
  const existingQuests = await prisma.quest.findMany({
    where: {
      userProfileId,
      date: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (existingQuests.length >= MAX_DAILY_QUESTS) {
    return existingQuests.slice(0, MAX_DAILY_QUESTS).map(toDailyQuest);
  }

  const existingQuestTypes = new Set(
    existingQuests.map((quest) => quest.questType),
  );
  const templates = await buildQuestTemplates(userProfileId);
  const missingTemplates = templates
    .filter((template) => !existingQuestTypes.has(template.questType))
    .slice(0, MAX_DAILY_QUESTS - existingQuests.length);

  if (missingTemplates.length > 0) {
    await prisma.quest.createMany({
      data: missingTemplates.map((template) => ({
        userProfileId,
        questType: template.questType,
        title: template.title,
        description: template.description,
        targetCount: template.targetCount,
        xpReward: template.xpReward,
        date: start,
      })),
    });
  }

  await syncDailyQuestProgress(userProfileId, now);

  return (
    await prisma.quest.findMany({
      where: {
        userProfileId,
        date: {
          gte: start,
          lt: end,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: MAX_DAILY_QUESTS,
    })
  ).map(toDailyQuest);
}
