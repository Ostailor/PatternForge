import { createHash } from "node:crypto";

import { Prisma, type GameEvent } from "@/generated/prisma/client";
import { GameEventType } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import type { Attempt, SolvedStatus } from "@/lib/types";

import type { GameEventMetadata, XPBreakdown } from "./types";
import { calculateAttemptXp, calculateReviewXp } from "./xp";

const RECENT_GAME_EVENT_LIMIT = 20;
const MAX_LEGACY_XP_ITEMS = 5000;

const gameEventTypes = [
  GameEventType.AttemptCompleted,
  GameEventType.ReviewCompleted,
  GameEventType.BattleCompleted,
  GameEventType.InterviewStarted,
  GameEventType.InterviewCompleted,
  GameEventType.InterviewStrongResult,
  GameEventType.InterviewImprovement,
  GameEventType.QuestCompleted,
  GameEventType.AchievementEarned,
  GameEventType.ContrastDrillCompleted,
  GameEventType.VoiceInterviewCompleted,
  GameEventType.SpeakingDrillCompleted,
  GameEventType.CommunicationInsightCreated,
] as const;

const sourceMetadataKeys = [
  ["attemptId", "attempt"],
  ["reviewLogId", "reviewLog"],
  ["battleId", "battle"],
  ["voiceSessionId", "voiceSession"],
  ["speakingDrillId", "speakingDrill"],
  ["communicationInsightId", "communicationInsight"],
  ["interviewId", "interview"],
  ["questId", "quest"],
  ["achievementId", "achievement"],
  ["contrastDrillId", "contrastDrill"],
] as const;

type GameEventWriteClient = Pick<ReturnType<typeof getPrisma>, "gameEvent">;

function createEmptyBreakdown(): XPBreakdown {
  return {
    AttemptCompleted: 0,
    ReviewCompleted: 0,
    BattleCompleted: 0,
    InterviewStarted: 0,
    InterviewCompleted: 0,
    InterviewStrongResult: 0,
    InterviewImprovement: 0,
    QuestCompleted: 0,
    AchievementEarned: 0,
    ContrastDrillCompleted: 0,
    VoiceInterviewCompleted: 0,
    SpeakingDrillCompleted: 0,
    CommunicationInsightCreated: 0,
    total: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringMetadata(
  metadata: GameEventMetadata | unknown,
  key: string,
): string | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

export function getLegacySourceId(metadata: GameEventMetadata | unknown): string | null {
  for (const [metadataKey] of sourceMetadataKeys) {
    const sourceId = readStringMetadata(metadata, metadataKey);

    if (sourceId) {
      return sourceId;
    }
  }

  return null;
}

export function buildGameEventKey(
  userProfileId: string,
  eventType: GameEventType,
  metadata: GameEventMetadata,
): string {
  for (const [metadataKey, sourceType] of sourceMetadataKeys) {
    const sourceId = readStringMetadata(metadata, metadataKey);

    if (sourceId) {
      return `${userProfileId}:${eventType}:${sourceType}:${sourceId}`;
    }
  }

  const metadataHash = createHash("sha256")
    .update(stableStringify(metadata))
    .digest("hex")
    .slice(0, 32);

  return `${userProfileId}:${eventType}:metadata:${metadataHash}`;
}

export async function createGameEventWithClient(
  client: GameEventWriteClient,
  userProfileId: string,
  eventType: GameEventType,
  xpAmount: number,
  description: string,
  metadata: GameEventMetadata,
): Promise<GameEvent> {
  const normalizedMetadata = metadata ?? {};
  const eventKey = buildGameEventKey(
    userProfileId,
    eventType,
    normalizedMetadata,
  );

  return client.gameEvent.upsert({
    where: { eventKey },
    create: {
      userProfileId,
      eventType,
      xpAmount,
      description,
      metadata: normalizedMetadata as Prisma.InputJsonValue,
      eventKey,
    },
    update: {},
  });
}

export async function createGameEvent(
  userProfileId: string,
  eventType: GameEventType,
  xpAmount: number,
  description: string,
  metadata: GameEventMetadata,
): Promise<GameEvent> {
  return createGameEventWithClient(
    getPrisma(),
    userProfileId,
    eventType,
    xpAmount,
    description,
    metadata,
  );
}

export function summarizeXPBreakdown(
  events: Pick<GameEvent, "eventType" | "xpAmount">[],
): XPBreakdown {
  const breakdown = createEmptyBreakdown();

  for (const event of events) {
    breakdown[event.eventType] += event.xpAmount;
    breakdown.total += event.xpAmount;
  }

  return breakdown;
}

function toSolvedStatus(solvedStatus: string): SolvedStatus {
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

function toAttemptForXp(attempt: {
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

function getEventSourceIdSet(
  events: Pick<GameEvent, "eventType" | "metadata">[],
  eventType: GameEventType,
): Set<string> {
  return new Set(
    events
      .filter((event) => event.eventType === eventType)
      .map((event) => getLegacySourceId(event.metadata))
      .filter((sourceId): sourceId is string => sourceId !== null),
  );
}

async function getLegacyAttemptXP(
  userProfileId: string,
  events: Pick<GameEvent, "eventType" | "metadata">[],
): Promise<number> {
  const eventAttemptIds = getEventSourceIdSet(
    events,
    GameEventType.AttemptCompleted,
  );
  const attempts = await getPrisma().attempt.findMany({
    where: { userProfileId },
    orderBy: { createdAt: "asc" },
    take: MAX_LEGACY_XP_ITEMS,
  });

  return attempts
    .filter((attempt) => !eventAttemptIds.has(attempt.id))
    .reduce(
      (total, attempt) => total + calculateAttemptXp(toAttemptForXp(attempt)),
      0,
    );
}

async function getLegacyReviewXP(
  userProfileId: string,
  events: Pick<GameEvent, "eventType" | "metadata">[],
): Promise<number> {
  const eventReviewLogIds = getEventSourceIdSet(
    events,
    GameEventType.ReviewCompleted,
  );
  const reviewLogs = await getPrisma().reviewLog.findMany({
    where: { userProfileId },
    select: {
      id: true,
      itemType: true,
      rating: true,
    },
    orderBy: { reviewedAt: "asc" },
    take: MAX_LEGACY_XP_ITEMS,
  });

  return reviewLogs
    .filter((reviewLog) => !eventReviewLogIds.has(reviewLog.id))
    .reduce(
      (total, reviewLog) =>
        total +
        calculateReviewXp({
          itemType: reviewLog.itemType,
          rating: reviewLog.rating,
        }),
      0,
    );
}

async function getAllEventsForXP(userProfileId: string) {
  return getPrisma().gameEvent.findMany({
    where: { userProfileId },
    select: {
      eventType: true,
      xpAmount: true,
      metadata: true,
    },
  });
}

export async function getTotalXP(userProfileId: string): Promise<number> {
  const events = await getAllEventsForXP(userProfileId);
  const eventTotal = events.reduce((total, event) => total + event.xpAmount, 0);
  const [legacyAttemptXP, legacyReviewXP] = await Promise.all([
    getLegacyAttemptXP(userProfileId, events),
    getLegacyReviewXP(userProfileId, events),
  ]);

  return eventTotal + legacyAttemptXP + legacyReviewXP;
}

export async function getRecentGameEvents(
  userProfileId: string,
  limit = RECENT_GAME_EVENT_LIMIT,
): Promise<GameEvent[]> {
  return getPrisma().gameEvent.findMany({
    where: { userProfileId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getXPBreakdown(
  userProfileId: string,
): Promise<XPBreakdown> {
  const events = await getAllEventsForXP(userProfileId);
  const breakdown = summarizeXPBreakdown(events);
  const [legacyAttemptXP, legacyReviewXP] = await Promise.all([
    getLegacyAttemptXP(userProfileId, events),
    getLegacyReviewXP(userProfileId, events),
  ]);

  breakdown.AttemptCompleted += legacyAttemptXP;
  breakdown.ReviewCompleted += legacyReviewXP;
  breakdown.total += legacyAttemptXP + legacyReviewXP;

  for (const eventType of gameEventTypes) {
    breakdown[eventType] ??= 0;
  }

  return breakdown;
}
