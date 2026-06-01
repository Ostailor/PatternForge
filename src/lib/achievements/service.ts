import { GameEventType } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { createGameEventWithClient } from "@/lib/game/events";
import { calculateAchievementXp } from "@/lib/game/xp";
import { getMasteryLevel, getPatternProgress } from "@/lib/mastery";
import { calculateMemoryStreak } from "@/lib/memory-streak";
import { getPrisma } from "@/lib/prisma";
import { progressFromAttempts } from "@/lib/progress";
import type { Attempt } from "@/lib/types";

import { achievementDefinitions } from "./definitions";

type AchievementClient = Prisma.TransactionClient | ReturnType<typeof getPrisma>;

export type AchievementCatalogItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
  earnedAt: string | null;
};

function getAchievementDefinition(key: string) {
  return achievementDefinitions.find((achievement) => achievement.key === key);
}

function toSolvedStatus(solvedStatus: string): Attempt["solvedStatus"] {
  switch (solvedStatus) {
    case "Solved":
      return "Solved";
    case "PartiallySolved":
      return "Partially Solved";
    case "NotSolved":
      return "Not Solved";
    default:
      return "Not Solved";
  }
}

function toAchievementAttempt(attempt: {
  id: string;
  problemId: string;
  selectedPatternId: string;
  correctPatternId: string;
  wasPatternCorrect: boolean;
  solvedStatus: string;
  timeSpentMinutes: number;
  confidence: number;
  reflection: string;
  createdAt: Date;
}): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: Math.min(Math.max(attempt.confidence, 1), 5) as Attempt["confidence"],
    reflection: attempt.reflection,
    createdAt: attempt.createdAt.toISOString(),
  };
}

export async function awardAchievementWithClient(
  client: AchievementClient,
  userProfileId: string,
  achievementKey: string,
) {
  const definition = getAchievementDefinition(achievementKey);

  if (!definition) {
    return null;
  }

  const achievement = await client.achievement.findUnique({
    where: {
      key: achievementKey,
    },
  });

  if (!achievement) {
    return null;
  }

  const existingUserAchievement = await client.userAchievement.findUnique({
    where: {
      userProfileId_achievementId: {
        userProfileId,
        achievementId: achievement.id,
      },
    },
  });

  if (existingUserAchievement) {
    return existingUserAchievement;
  }

  const userAchievement = await client.userAchievement.create({
    data: {
      userProfileId,
      achievementId: achievement.id,
    },
  });

  await createGameEventWithClient(
    client,
    userProfileId,
    GameEventType.AchievementEarned,
    calculateAchievementXp({ xpReward: achievement.xpReward }),
    "Achievement earned",
    {
      achievementId: achievement.id,
      userAchievementId: userAchievement.id,
      achievementKey,
    },
  );

  return userAchievement;
}

export async function awardAchievement(
  userProfileId: string,
  achievementKey: string,
) {
  return getPrisma().$transaction((tx) =>
    awardAchievementWithClient(tx, userProfileId, achievementKey),
  );
}

async function getAchievementProgress(client: AchievementClient, userProfileId: string) {
  const [attempts, mistakeCount, reviewCount, victoryCount, reviewGauntletCount] =
    await Promise.all([
      client.attempt.findMany({
        where: { userProfileId },
        orderBy: { createdAt: "asc" },
      }),
      client.mistake.count({
        where: { userProfileId },
      }),
      client.reviewLog.count({
        where: { userProfileId },
      }),
      client.battle.count({
        where: {
          userProfileId,
          status: "Completed",
          result: "Victory",
        },
      }),
      client.battle.count({
        where: {
          userProfileId,
          status: "Completed",
          battleType: "ReviewGauntlet",
        },
      }),
    ]);
  const appAttempts = attempts.map(toAchievementAttempt);
  const progress = progressFromAttempts(appAttempts);
  const slidingWindowProgress = getPatternProgress("sliding-window", progress);
  const reviewDates = await client.reviewLog.findMany({
    where: { userProfileId },
    select: { reviewedAt: true },
  });
  const memoryStreak = calculateMemoryStreak({
    attempts: appAttempts,
    reviewDates: reviewDates.map((reviewLog) => reviewLog.reviewedAt),
  });

  return {
    attemptCount: attempts.length,
    correctRecognitionCount: attempts.filter((attempt) => attempt.wasPatternCorrect)
      .length,
    mistakeCount,
    reviewCount,
    victoryCount,
    reviewGauntletCount,
    memoryStreak,
    slidingWindowMastery: slidingWindowProgress.masteryScore,
    slidingWindowLevel: getMasteryLevel(slidingWindowProgress.masteryScore),
  };
}

export async function checkAchievementsWithClient(
  client: AchievementClient,
  userProfileId: string,
) {
  const progress = await getAchievementProgress(client, userProfileId);
  const earnedKeys = [
    progress.attemptCount >= 1 ? "first-forge" : "",
    progress.correctRecognitionCount >= 10 ? "pattern-scout" : "",
    progress.mistakeCount >= 10 ? "mistake-forger" : "",
    progress.reviewCount >= 25 ? "memory-smith" : "",
    progress.victoryCount >= 1 ? "boss-slayer" : "",
    progress.memoryStreak >= 3 ? "streak-spark" : "",
    progress.slidingWindowMastery >= 80 ? "sliding-window-sharp" : "",
    progress.reviewGauntletCount >= 1 ? "review-gauntlet-survivor" : "",
  ].filter(Boolean);

  for (const achievementKey of earnedKeys) {
    await awardAchievementWithClient(client, userProfileId, achievementKey);
  }
}

export async function checkAchievements(userProfileId: string) {
  await getPrisma().$transaction((tx) =>
    checkAchievementsWithClient(tx, userProfileId),
  );
}

export async function getAchievementCatalog(
  userProfileId: string,
): Promise<AchievementCatalogItem[]> {
  await checkAchievements(userProfileId);

  const [achievements, userAchievements] = await Promise.all([
    getPrisma().achievement.findMany({
      orderBy: [{ createdAt: "asc" }, { name: "asc" }],
    }),
    getPrisma().userAchievement.findMany({
      where: { userProfileId },
      include: {
        achievement: true,
      },
      orderBy: { earnedAt: "desc" },
    }),
  ]);
  const earnedByAchievementId = new Map(
    userAchievements.map((userAchievement) => [
      userAchievement.achievementId,
      userAchievement.earnedAt,
    ]),
  );

  return achievements.map((achievement) => ({
    id: achievement.id,
    key: achievement.key,
    name: achievement.name,
    description: achievement.description,
    icon: achievement.icon,
    xpReward: achievement.xpReward,
    earnedAt: earnedByAchievementId.get(achievement.id)?.toISOString() ?? null,
  }));
}
