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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMetadataString(value: unknown, key: string): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const metadataValue = value[key];

  return typeof metadataValue === "string" && metadataValue.trim()
    ? metadataValue
    : null;
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

  const achievement = await client.achievement.upsert({
    where: {
      key: achievementKey,
    },
    update: {
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      xpReward: definition.xpReward,
    },
    create: {
      key: definition.key,
      name: definition.name,
      description: definition.description,
      icon: definition.icon,
      xpReward: definition.xpReward,
    },
  });

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
  const [
    attempts,
    mistakeCount,
    reviewCount,
    victoryCount,
    reviewGauntletCount,
    interviews,
    completedVoiceInterviewCount,
    voiceFeedback,
    speakingDrillEvents,
  ] =
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
      client.interviewSession.findMany({
        where: {
          userProfileId,
          status: "Completed",
        },
        select: {
          overallScore: true,
          communicationScore: true,
          testingScore: true,
          complexityScore: true,
          completedAt: true,
          createdAt: true,
        },
        orderBy: [{ completedAt: "asc" }, { createdAt: "asc" }],
      }),
      client.voiceSession.count({
        where: {
          userProfileId,
          status: "Completed",
          turns: {
            some: {
              speaker: "User",
            },
          },
        },
      }),
      client.voiceFeedback.findMany({
        where: { userProfileId },
        select: {
          clarityScore: true,
          structureScore: true,
          technicalExplanationScore: true,
        },
      }),
      client.gameEvent.findMany({
        where: {
          userProfileId,
          eventType: GameEventType.SpeakingDrillCompleted,
        },
        select: {
          metadata: true,
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
  const interviewScores = interviews
    .map((interview) => interview.overallScore)
    .filter((score): score is number => typeof score === "number");
  const bestInterviewImprovement = interviewScores.reduce(
    (bestImprovement, score, index) => {
      if (index === 0) {
        return bestImprovement;
      }

      return Math.max(bestImprovement, score - interviewScores[index - 1]);
    },
    0,
  );
  const complexitySpeakingDrillCount = speakingDrillEvents.filter(
    (event) => readMetadataString(event.metadata, "drillType") === "complexity",
  ).length;

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
    completedInterviewCount: interviews.length,
    hasClearCommunicator: interviews.some(
      (interview) => (interview.communicationScore ?? 0) >= 85,
    ),
    hasComplexityClean: interviews.some(
      (interview) => (interview.complexityScore ?? 0) >= 90,
    ),
    hasEdgeCaseHunter: interviews.some(
      (interview) => (interview.testingScore ?? 0) >= 85,
    ),
    hasInterviewReady: interviewScores.some((score) => score >= 85),
    bestInterviewImprovement,
    completedVoiceInterviewCount,
    hasClearExplainer: voiceFeedback.some(
      (feedback) => feedback.clarityScore >= 85,
    ),
    hasStructuredThinker: voiceFeedback.some(
      (feedback) => feedback.structureScore >= 85,
    ),
    hasPatternNarrator: voiceFeedback.some(
      (feedback) => feedback.technicalExplanationScore >= 85,
    ),
    complexitySpeakingDrillCount,
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
    progress.completedInterviewCount >= 1 ? "first-mock" : "",
    progress.hasClearCommunicator ? "clear-communicator" : "",
    progress.hasComplexityClean ? "complexity-clean" : "",
    progress.hasEdgeCaseHunter ? "edge-case-hunter" : "",
    progress.hasInterviewReady ? "interview-ready" : "",
    progress.bestInterviewImprovement >= 20 ? "comeback-candidate" : "",
    progress.completedVoiceInterviewCount >= 1 ? "first-spoken-forge" : "",
    progress.hasClearExplainer ? "clear-explainer" : "",
    progress.hasStructuredThinker ? "structured-thinker" : "",
    progress.hasPatternNarrator ? "pattern-narrator" : "",
    progress.complexitySpeakingDrillCount >= 5 ? "complexity-speaker" : "",
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
