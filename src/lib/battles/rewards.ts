import { GameEventType, type BattleType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { createGameEventWithClient } from "@/lib/game/events";
import { calculateAchievementXp, calculateQuestXp } from "@/lib/game/xp";

import type { BattleScore } from "./scoreBattle";

type BattleRewardInput = {
  userProfileId: string;
  battleId: string;
  battleType: BattleType;
  targetPatternId: string | null;
  score: BattleScore;
};

function getQuestTypesForBattle({
  battleType,
  score,
}: Pick<BattleRewardInput, "battleType" | "score">): Set<string> {
  const questTypes = new Set([
    "BattleCompleted",
    "CompleteBattle",
    "CompleteAnyBattle",
    battleType,
  ]);

  if (score.result === "Victory") {
    questTypes.add("BattleVictory");
    questTypes.add("WinBattle");
  }

  if (score.result === "PartialVictory") {
    questTypes.add("BattlePartialVictory");
  }

  return questTypes;
}

function getAchievementKeysForBattle({
  battleType,
  score,
}: Pick<BattleRewardInput, "battleType" | "score">): string[] {
  return [
    "first-battle-completed",
    score.result === "Victory" ? "first-battle-victory" : "",
    battleType === "PatternBoss" && score.result === "Victory"
      ? "first-pattern-boss-victory"
      : "",
    score.recognitionAccuracy >= 1 ? "perfect-battle-recognition" : "",
  ].filter(Boolean);
}

export async function checkBattleQuestsAndAchievements(
  client: Prisma.TransactionClient,
  input: BattleRewardInput,
) {
  const questTypes = getQuestTypesForBattle(input);
  const activeQuests = await client.quest.findMany({
    where: {
      userProfileId: input.userProfileId,
      status: "Active",
      questType: {
        in: Array.from(questTypes),
      },
    },
  });

  for (const quest of activeQuests) {
    const nextCount = Math.min(quest.targetCount, quest.currentCount + 1);
    const completed = nextCount >= quest.targetCount;

    await client.quest.update({
      where: {
        id: quest.id,
      },
      data: {
        currentCount: nextCount,
        status: completed ? "Completed" : "Active",
        completedAt: completed ? new Date() : null,
      },
    });

    if (completed) {
      await createGameEventWithClient(
        client,
        input.userProfileId,
        GameEventType.QuestCompleted,
        calculateQuestXp({ xpReward: quest.xpReward }),
        "Quest completed",
        {
          questId: quest.id,
          battleId: input.battleId,
          questType: quest.questType,
        },
      );
    }
  }

  const achievementKeys = getAchievementKeysForBattle(input);

  if (achievementKeys.length === 0) {
    return;
  }

  const achievements = await client.achievement.findMany({
    where: {
      key: {
        in: achievementKeys,
      },
    },
  });
  const existingUserAchievements = new Set(
    (
      await client.userAchievement.findMany({
        where: {
          userProfileId: input.userProfileId,
          achievementId: {
            in: achievements.map((achievement) => achievement.id),
          },
        },
        select: {
          achievementId: true,
        },
      })
    ).map((userAchievement) => userAchievement.achievementId),
  );

  for (const achievement of achievements) {
    if (existingUserAchievements.has(achievement.id)) {
      continue;
    }

    const userAchievement = await client.userAchievement.create({
      data: {
        userProfileId: input.userProfileId,
        achievementId: achievement.id,
      },
    });

    await createGameEventWithClient(
      client,
      input.userProfileId,
      GameEventType.AchievementEarned,
      calculateAchievementXp({ xpReward: achievement.xpReward }),
      "Achievement earned",
      {
        achievementId: achievement.id,
        userAchievementId: userAchievement.id,
        battleId: input.battleId,
        achievementKey: achievement.key,
      },
    );
  }
}
