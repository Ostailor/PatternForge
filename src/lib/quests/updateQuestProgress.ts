import { GameEventType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { createGameEventWithClient } from "@/lib/game/events";
import { calculateQuestXp } from "@/lib/game/xp";
import { getPrisma } from "@/lib/prisma";
import type { QuestProgressEvent } from "@/lib/quests/types";

function getUtcDayWindow(now = new Date()) {
  const start = new Date(now);

  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { start, end };
}

function getWeakestPatternQuestPatternId(questType: string): string | null {
  const prefix = "PracticeWeakestPattern:";

  return questType.startsWith(prefix) ? questType.slice(prefix.length) : null;
}

async function getQuestCurrentCount({
  client,
  userProfileId,
  questType,
  start,
  end,
  now,
}: {
  client: Prisma.TransactionClient;
  userProfileId: string;
  questType: string;
  start: Date;
  end: Date;
  now: Date;
}) {
  const weakestPatternId = getWeakestPatternQuestPatternId(questType);

  if (questType === "CompleteAttempt") {
    return client.attempt.count({
      where: {
        userProfileId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (questType === "CorrectPatterns") {
    return client.attempt.count({
      where: {
        userProfileId,
        wasPatternCorrect: true,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (weakestPatternId) {
    return client.attempt.count({
      where: {
        userProfileId,
        correctPatternId: weakestPatternId,
        createdAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (questType === "ReviewFlashcards") {
    return client.reviewLog.count({
      where: {
        userProfileId,
        itemType: "Flashcard",
        reviewedAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (questType === "ReviewMistake") {
    return client.reviewLog.count({
      where: {
        userProfileId,
        itemType: "Mistake",
        reviewedAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (questType === "CompleteBossBattle") {
    return client.battle.count({
      where: {
        userProfileId,
        status: "Completed",
        completedAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }

  if (questType === "CompleteDueReviews") {
    const [dueFlashcardsCount, dueMistakesCount, reviewedTodayCount] =
      await Promise.all([
        client.flashcard.count({
          where: {
            userProfileId,
            status: "active",
            reviewDueAt: {
              lte: now,
            },
          },
        }),
        client.mistake.count({
          where: {
            userProfileId,
            status: "active",
            reviewDueAt: {
              lte: now,
            },
          },
        }),
        client.reviewLog.count({
          where: {
            userProfileId,
            reviewedAt: {
              gte: start,
              lt: end,
            },
          },
        }),
      ]);

    return dueFlashcardsCount + dueMistakesCount === 0 && reviewedTodayCount > 0
      ? 1
      : 0;
  }

  return 0;
}

export async function syncDailyQuestProgressWithClient(
  client: Prisma.TransactionClient,
  userProfileId: string,
  now = new Date(),
) {
  const { start, end } = getUtcDayWindow(now);
  const activeQuests = await client.quest.findMany({
    where: {
      userProfileId,
      status: "Active",
      date: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  for (const quest of activeQuests) {
    const currentCount = Math.min(
      quest.targetCount,
      await getQuestCurrentCount({
        client,
        userProfileId,
        questType: quest.questType,
        start,
        end,
        now,
      }),
    );
    const completed = currentCount >= quest.targetCount;

    await client.quest.update({
      where: {
        id: quest.id,
      },
      data: {
        currentCount,
        status: completed ? "Completed" : "Active",
        completedAt: completed ? now : null,
      },
    });

    if (completed) {
      await createGameEventWithClient(
        client,
        userProfileId,
        GameEventType.QuestCompleted,
        calculateQuestXp({ xpReward: quest.xpReward }),
        "Daily quest completed",
        {
          questId: quest.id,
          questType: quest.questType,
          date: start.toISOString(),
        },
      );
    }
  }
}

export async function syncDailyQuestProgress(
  userProfileId: string,
  now = new Date(),
) {
  await getPrisma().$transaction((tx) =>
    syncDailyQuestProgressWithClient(tx, userProfileId, now),
  );
}

export async function updateQuestProgress(
  client: Prisma.TransactionClient,
  userProfileId: string,
  _event: QuestProgressEvent,
) {
  void _event;
  await syncDailyQuestProgressWithClient(client, userProfileId);
}
