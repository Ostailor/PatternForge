import {
  Prisma,
  SolvedStatus as PrismaSolvedStatus,
  type Attempt as DbAttempt,
} from "@/generated/prisma/client";
import { patterns } from "@/data/patterns";
import { achievementDefinitions } from "@/lib/achievements/definitions";
import {
  checkAchievementsWithClient,
  getAchievementCatalog,
} from "@/lib/achievements/service";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { summarizeBattleStats } from "@/lib/battles/dashboard";
import {
  getGamificationStats,
  type ReviewXpActivity,
} from "@/lib/gamification";
import {
  createGameEventWithClient,
  getRecentGameEvents,
  getTotalXP,
} from "@/lib/game/events";
import { calculateAttemptXp as calculateAttemptGameXp } from "@/lib/game/xp";
import { getPatternProgress } from "@/lib/mastery";
import { calculateMemoryStreak } from "@/lib/memory-streak";
import { getPrisma } from "@/lib/prisma";
import { progressFromAttempts } from "@/lib/progress";
import { generateDailyQuests } from "@/lib/quests/generateDailyQuests";
import { updateQuestProgress } from "@/lib/quests/updateQuestProgress";
import { STARTING_PATH_TITLE } from "@/lib/learning-plans/startingPath";
import {
  toDashboardRecommendation,
  type DashboardRecommendation,
  type SavedRecommendationForDashboard,
} from "@/lib/recommendations/dashboard";
import { updatePatternConfusionOnAttemptWithClient } from "@/lib/recommendations/patternConfusion";
import { getReviewStats, type ReviewStats } from "@/lib/review/queue";
import type { ReviewRating } from "@/lib/review/types";
import type {
  Attempt,
  Confidence,
  PatternProgress,
  SolvedStatus,
  UserProgress,
} from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const DASHBOARD_PROGRESS_ATTEMPT_LIMIT = 120;

export type DashboardOnboardingState = {
  status: string;
  currentStep: string;
  completedAt: string | null;
  skippedAt: string | null;
};

export type DashboardStartingPath = {
  planId: string;
  title: string;
  whyChosen: string;
  todayStep: {
    id: string;
    dayIndex: number;
    stepType: string;
    title: string;
    targetPatternId: string | null;
    targetPatternName: string | null;
    problemId: string | null;
    problemTitle: string | null;
    dueDate: string;
  } | null;
};

export type CreateAttemptInput = {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  codeSubmissionId?: string;
  createdAt?: string;
};

export type DashboardBattleCardData = {
  activeBattle: {
    id: string;
    title: string;
    battleType: string;
    targetPatternName: string | null;
    completedRounds: number;
    totalRounds: number;
    progress: number;
    startedAt: string;
  } | null;
  recommendedBattle: {
    battleType: string;
    title: string;
    description: string;
    reason: string;
  };
  stats: {
    completed: number;
    victories: number;
    partialVictories: number;
    averageRecognitionAccuracy: number;
  };
  entryHref: string;
  buttonLabel: string;
};

export type DashboardGameEventItem = {
  id: string;
  eventType: string;
  title: string;
  description: string;
  xpAmount: number;
  createdAt: string;
};

export type DashboardAchievementPreview = {
  recentEarned: {
    id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    xpReward: number;
    earnedAt: string;
  }[];
  nextBadge: {
    id: string;
    key: string;
    name: string;
    description: string;
    icon: string;
    xpReward: number;
  } | null;
};

export type DashboardGamificationData = {
  battleCard: DashboardBattleCardData;
  recentGameEvents: {
    events: DashboardGameEventItem[];
    xpEarned: number;
    achievementsEarned: number;
    battlesCompleted: number;
    questsCompleted: number;
    voiceEvents: number;
  };
  achievementsPreview: DashboardAchievementPreview;
};

export type UserProgressSnapshot = {
  progress: UserProgress | null;
  dashboardStats: ReturnType<typeof getGamificationStats> | null;
  patternProgress: PatternProgress | null;
  patternProgressById: Record<string, PatternProgress> | null;
  reviewStats: (ReviewStats & { memoryStreak: number }) | null;
  dailyQuests: Awaited<ReturnType<typeof generateDailyQuests>> | null;
  dashboardGamification: DashboardGamificationData | null;
  nextBestAction: DashboardRecommendation | null;
  onboardingState: DashboardOnboardingState | null;
  startingPath: DashboardStartingPath | null;
};

export type ImportAttemptsResult = {
  importedCount: number;
  skippedCount: number;
};

function toSolvedStatus(solvedStatus: PrismaSolvedStatus): SolvedStatus {
  switch (solvedStatus) {
    case PrismaSolvedStatus.Solved:
      return "Solved";
    case PrismaSolvedStatus.PartiallySolved:
      return "Partially Solved";
    case PrismaSolvedStatus.NotSolved:
      return "Not Solved";
  }
}

function toPrismaSolvedStatus(solvedStatus: SolvedStatus): PrismaSolvedStatus {
  switch (solvedStatus) {
    case "Solved":
      return PrismaSolvedStatus.Solved;
    case "Partially Solved":
      return PrismaSolvedStatus.PartiallySolved;
    case "Not Solved":
      return PrismaSolvedStatus.NotSolved;
  }
}

export function toAppAttempt(attempt: DbAttempt): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: attempt.confidence as Attempt["confidence"],
    reflection: attempt.reflection,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function normalizeCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt) {
    return undefined;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

type PatternMasteryInputs = {
  explanationScores: number[];
  retentionRatings: ReviewRating[];
};

const MAX_PATTERN_SIGNAL_COUNT = 20;
const MAX_RECENT_REVIEW_LOGS = 1000;
const MAX_RECENT_AI_REVIEWS = 500;
const MAX_XP_REVIEW_LOGS = 5000;
const RECENT_DASHBOARD_EVENT_COUNT = 8;

function readJsonString(value: Prisma.JsonValue, key: string): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const field = value[key];

  return typeof field === "string" && field.trim() ? field : null;
}

function getUniqueAttemptedProblemCount(attempts: Attempt[]): number {
  return new Set(attempts.map((attempt) => attempt.problemId)).size;
}

function getRecommendedBattle({
  attempts,
  reviewSignalCount,
  patternProgressById,
}: {
  attempts: Attempt[];
  reviewSignalCount: number;
  patternProgressById: Record<string, PatternProgress>;
}): DashboardBattleCardData["recommendedBattle"] {
  const uniqueAttemptedProblemCount = getUniqueAttemptedProblemCount(attempts);

  if (reviewSignalCount >= 3) {
    return {
      battleType: "ReviewGauntlet",
      title: "Review Gauntlet",
      description: "Turn recent mistakes and hard reviews into a focused run.",
      reason: `${reviewSignalCount} review signals are ready.`,
    };
  }

  if (uniqueAttemptedProblemCount >= 5) {
    return {
      battleType: "MixedBattle",
      title: "Mixed Battle",
      description: "Mix practiced patterns to test recognition under pressure.",
      reason: `${uniqueAttemptedProblemCount} unique problems attempted.`,
    };
  }

  const targetPattern =
    patterns
      .map((pattern) => ({
        pattern,
        progress: patternProgressById[pattern.id],
      }))
      .filter(({ progress }) => (progress?.attemptedCount ?? 0) > 0)
      .sort(
        (a, b) =>
          (a.progress?.masteryScore ?? 0) -
            (b.progress?.masteryScore ?? 0) ||
          a.pattern.levelOrder - b.pattern.levelOrder,
      )[0]?.pattern ?? patterns.find((pattern) => pattern.id === "arrays-hashing");

  return {
    battleType: "PatternBoss",
    title: targetPattern ? `${targetPattern.name} Pattern Boss` : "Pattern Boss",
    description: "Duel one pattern and build battle history without waiting.",
    reason:
      attempts.length === 0
        ? "Start with an easy first boss."
        : "Sharpen your weakest practiced lane.",
  };
}

function formatEventTitle(
  event: Awaited<ReturnType<typeof getRecentGameEvents>>[number],
  lookups: {
    achievements: Map<string, string>;
    battles: Map<string, string>;
    interviews: Map<string, string>;
    quests: Map<string, string>;
  },
): string {
  switch (event.eventType) {
    case "AchievementEarned": {
      const achievementId = readJsonString(event.metadata, "achievementId");
      const achievementKey = readJsonString(event.metadata, "achievementKey");
      const fallback = achievementDefinitions.find(
        (definition) => definition.key === achievementKey,
      )?.name;

      return `Achievement: ${
        (achievementId ? lookups.achievements.get(achievementId) : null) ??
        fallback ??
        "Badge earned"
      }`;
    }
    case "BattleCompleted": {
      const battleId = readJsonString(event.metadata, "battleId");

      return `${
        (battleId ? lookups.battles.get(battleId) : null) ?? "Boss Battle"
      } completed`;
    }
    case "InterviewStarted": {
      const interviewId = readJsonString(event.metadata, "interviewId");

      return `${
        (interviewId ? lookups.interviews.get(interviewId) : null) ??
        "Interview"
      } started`;
    }
    case "InterviewCompleted": {
      const interviewId = readJsonString(event.metadata, "interviewId");

      return `${
        (interviewId ? lookups.interviews.get(interviewId) : null) ??
        "Interview"
      } completed`;
    }
    case "InterviewStrongResult": {
      const interviewId = readJsonString(event.metadata, "interviewId");

      return `Strong result: ${
        (interviewId ? lookups.interviews.get(interviewId) : null) ??
        "Interview"
      }`;
    }
    case "InterviewImprovement": {
      const interviewId = readJsonString(event.metadata, "interviewId");

      return `Improved: ${
        (interviewId ? lookups.interviews.get(interviewId) : null) ??
        "Interview"
      }`;
    }
    case "QuestCompleted": {
      const questId = readJsonString(event.metadata, "questId");

      return `Quest: ${
        (questId ? lookups.quests.get(questId) : null) ?? "Daily objective"
      }`;
    }
    case "VoiceInterviewCompleted": {
      const interviewId = readJsonString(event.metadata, "interviewId");

      return `Voice interview: ${
        (interviewId ? lookups.interviews.get(interviewId) : null) ??
        "Mock interview"
      }`;
    }
    case "SpeakingDrillCompleted":
      return "Speaking drill completed";
    case "CommunicationInsightCreated":
      return "Communication insight logged";
    case "AttemptCompleted":
      return "Practice attempt completed";
    case "ReviewCompleted":
      return "Review completed";
    default:
      return event.description;
  }
}

async function getRecentDashboardEvents(
  userProfileId: string,
): Promise<DashboardGamificationData["recentGameEvents"]> {
  const events = await getRecentGameEvents(
    userProfileId,
    RECENT_DASHBOARD_EVENT_COUNT,
  );
  const achievementIds = events
    .map((event) => readJsonString(event.metadata, "achievementId"))
    .filter((id): id is string => id !== null);
  const battleIds = events
    .map((event) => readJsonString(event.metadata, "battleId"))
    .filter((id): id is string => id !== null);
  const interviewIds = events
    .map((event) => readJsonString(event.metadata, "interviewId"))
    .filter((id): id is string => id !== null);
  const questIds = events
    .map((event) => readJsonString(event.metadata, "questId"))
    .filter((id): id is string => id !== null);
  const [achievements, battles, interviews, quests] = await Promise.all([
    achievementIds.length > 0
      ? getPrisma().achievement.findMany({
          where: { id: { in: achievementIds } },
          select: { id: true, name: true },
        })
      : [],
    battleIds.length > 0
      ? getPrisma().battle.findMany({
          where: { id: { in: battleIds } },
          select: { id: true, title: true },
        })
      : [],
    interviewIds.length > 0
      ? getPrisma().interviewSession.findMany({
          where: { id: { in: interviewIds }, userProfileId },
          select: { id: true, title: true },
        })
      : [],
    questIds.length > 0
      ? getPrisma().quest.findMany({
          where: { id: { in: questIds } },
          select: { id: true, title: true },
        })
      : [],
  ]);
  const lookups = {
    achievements: new Map(
      achievements.map((achievement) => [achievement.id, achievement.name]),
    ),
    battles: new Map(battles.map((battle) => [battle.id, battle.title])),
    interviews: new Map(
      interviews.map((interview) => [interview.id, interview.title]),
    ),
    quests: new Map(quests.map((quest) => [quest.id, quest.title])),
  };

  return {
    events: events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      title: formatEventTitle(event, lookups),
      description: event.description,
      xpAmount: event.xpAmount,
      createdAt: event.createdAt.toISOString(),
    })),
    xpEarned: events.reduce((total, event) => total + event.xpAmount, 0),
    achievementsEarned: events.filter(
      (event) => event.eventType === "AchievementEarned",
    ).length,
    battlesCompleted: events.filter(
      (event) => event.eventType === "BattleCompleted",
    ).length,
    questsCompleted: events.filter((event) => event.eventType === "QuestCompleted")
      .length,
    voiceEvents: events.filter(
      (event) =>
        event.eventType === "VoiceInterviewCompleted" ||
        event.eventType === "SpeakingDrillCompleted" ||
        event.eventType === "CommunicationInsightCreated",
    ).length,
  };
}

async function getDashboardAchievementPreview(
  userProfileId: string,
): Promise<DashboardAchievementPreview> {
  const catalog = await getAchievementCatalog(userProfileId);
  const sourceCatalog =
    catalog.length > 0
      ? catalog
      : achievementDefinitions.map((definition) => ({
          id: definition.key,
          key: definition.key,
          name: definition.name,
          description: definition.description,
          icon: definition.icon,
          xpReward: definition.xpReward,
          earnedAt: null,
        }));
  const recentEarned = sourceCatalog
    .filter((achievement) => achievement.earnedAt)
    .sort(
      (a, b) =>
        new Date(b.earnedAt ?? 0).getTime() -
        new Date(a.earnedAt ?? 0).getTime(),
    )
    .slice(0, 3)
    .map((achievement) => ({
      ...achievement,
      earnedAt: achievement.earnedAt ?? "",
    }));
  const nextBadge =
    sourceCatalog.find((achievement) => !achievement.earnedAt) ?? null;

  return {
    recentEarned,
    nextBadge: nextBadge
      ? {
          id: nextBadge.id,
          key: nextBadge.key,
          name: nextBadge.name,
          description: nextBadge.description,
          icon: nextBadge.icon,
          xpReward: nextBadge.xpReward,
        }
      : null,
  };
}

async function getDashboardReviewSignalCount(userProfileId: string): Promise<number> {
  const [mistakeCount, reviewCount] = await Promise.all([
    getPrisma().mistake.count({
      where: { userProfileId },
    }),
    getPrisma().reviewLog.count({
      where: { userProfileId },
    }),
  ]);

  return mistakeCount + reviewCount;
}

async function getDashboardBattleCardData({
  userProfileId,
  attempts,
  patternProgressById,
}: {
  userProfileId: string;
  attempts: Attempt[];
  patternProgressById: Record<string, PatternProgress>;
}): Promise<DashboardBattleCardData> {
  const [activeBattle, completedBattles, reviewSignalCount] = await Promise.all([
    getPrisma().battle.findFirst({
      where: {
        userProfileId,
        status: "Active",
      },
      include: {
        targetPattern: true,
        rounds: {
          select: {
            completedAt: true,
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
    getPrisma().battle.findMany({
      where: {
        userProfileId,
        status: "Completed",
      },
      include: {
        targetPattern: true,
        rounds: {
          include: {
            attempt: {
              select: {
                wasPatternCorrect: true,
              },
            },
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    getDashboardReviewSignalCount(userProfileId),
  ]);
  const stats = summarizeBattleStats(
    completedBattles.map((battle) => ({
      battleType: battle.battleType,
      result: battle.result,
      targetPatternName: battle.targetPattern?.name,
      rounds: battle.rounds.map((round) => ({
        wasPatternCorrect: round.attempt?.wasPatternCorrect ?? null,
      })),
    })),
  );
  const completedRounds =
    activeBattle?.rounds.filter((round) => round.completedAt).length ?? 0;
  const totalRounds = activeBattle?.totalRounds ?? 0;

  return {
    activeBattle: activeBattle
      ? {
          id: activeBattle.id,
          title: activeBattle.title,
          battleType: activeBattle.battleType,
          targetPatternName: activeBattle.targetPattern?.name ?? null,
          completedRounds,
          totalRounds,
          progress:
            totalRounds === 0
              ? 0
              : Math.round((completedRounds / totalRounds) * 100),
          startedAt: activeBattle.startedAt.toISOString(),
        }
      : null,
    recommendedBattle: getRecommendedBattle({
      attempts,
      reviewSignalCount,
      patternProgressById,
    }),
    stats: {
      completed: stats.battlesCompleted,
      victories: stats.victories,
      partialVictories: stats.partialVictories,
      averageRecognitionAccuracy: stats.averageRecognitionAccuracy,
    },
    entryHref: activeBattle ? `/battles/${activeBattle.id}` : "/battles",
    buttonLabel: activeBattle ? "Enter Battle" : "Enter Battle",
  };
}

async function getDashboardGamificationData({
  userProfileId,
  attempts,
  patternProgressById,
}: {
  userProfileId: string;
  attempts: Attempt[];
  patternProgressById: Record<string, PatternProgress>;
}): Promise<DashboardGamificationData> {
  const achievementsPreview = await getDashboardAchievementPreview(userProfileId);
  const [battleCard, recentGameEvents] = await Promise.all([
    getDashboardBattleCardData({
      userProfileId,
      attempts,
      patternProgressById,
    }),
    getRecentDashboardEvents(userProfileId),
  ]);

  return {
    battleCard,
    recentGameEvents,
    achievementsPreview,
  };
}

function createPatternMasteryInputMap(): Map<string, PatternMasteryInputs> {
  return new Map(
    patterns.map((pattern) => [
      pattern.id,
      {
        explanationScores: [],
        retentionRatings: [],
      },
    ]),
  );
}

async function getPatternMasteryInputMap(
  userProfileId: string,
): Promise<Map<string, PatternMasteryInputs>> {
  const prisma = getPrisma();
  const inputMap = createPatternMasteryInputMap();
  const [aiReviews, reviewLogs] = await Promise.all([
    prisma.aIReview.findMany({
      where: { userProfileId },
      select: {
        patternId: true,
        explanationScore: true,
      },
      orderBy: { createdAt: "desc" },
      take: MAX_RECENT_AI_REVIEWS,
    }),
    prisma.reviewLog.findMany({
      where: { userProfileId },
      select: {
        rating: true,
        flashcard: {
          select: {
            patternId: true,
          },
        },
        mistake: {
          select: {
            patternId: true,
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: MAX_RECENT_REVIEW_LOGS,
    }),
  ]);

  for (const review of aiReviews) {
    const input = inputMap.get(review.patternId);

    if (!input || input.explanationScores.length >= MAX_PATTERN_SIGNAL_COUNT) {
      continue;
    }

    input.explanationScores.push(review.explanationScore);
  }

  for (const reviewLog of reviewLogs) {
    const patternId =
      reviewLog.flashcard?.patternId ?? reviewLog.mistake?.patternId;
    const input = patternId ? inputMap.get(patternId) : undefined;

    if (!input || input.retentionRatings.length >= MAX_PATTERN_SIGNAL_COUNT) {
      continue;
    }

    input.retentionRatings.push(reviewLog.rating);
  }

  return inputMap;
}

function getPatternProgressById(
  progress: UserProgress,
  inputMap: Map<string, PatternMasteryInputs>,
): Record<string, PatternProgress> {
  return Object.fromEntries(
    patterns.map((pattern) => {
      const input = inputMap.get(pattern.id);

      return [
        pattern.id,
        getPatternProgress(pattern.id, progress, {
          explanationScores: input?.explanationScores,
          retentionRatings: input?.retentionRatings,
        }),
      ];
    }),
  );
}

function getImportKey({
  problemId,
  selectedPatternId,
  solvedStatus,
  createdAt,
}: {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  createdAt?: string;
}) {
  return [
    problemId,
    selectedPatternId,
    solvedStatus,
    normalizeCreatedAt(createdAt) ?? "no-date",
  ].join("|");
}

async function getReviewXpActivities(
  userProfileId: string,
): Promise<ReviewXpActivity[]> {
  const reviewLogs = await getPrisma().reviewLog.findMany({
    where: { userProfileId },
    select: {
      itemType: true,
      rating: true,
      reviewedAt: true,
      mistakeId: true,
      mistake: {
        select: {
          lapses: true,
        },
      },
    },
    orderBy: { reviewedAt: "asc" },
    take: MAX_XP_REVIEW_LOGS,
  });
  const mistakeAgainCounts = new Map<string, number>();
  const mistakeCurrentLapses = new Map<string, number>();

  for (const reviewLog of reviewLogs) {
    if (reviewLog.itemType !== "Mistake" || !reviewLog.mistakeId) {
      continue;
    }

    mistakeCurrentLapses.set(
      reviewLog.mistakeId,
      reviewLog.mistake?.lapses ?? 0,
    );

    if (reviewLog.rating === "Again") {
      mistakeAgainCounts.set(
        reviewLog.mistakeId,
        (mistakeAgainCounts.get(reviewLog.mistakeId) ?? 0) + 1,
      );
    }
  }
  const mistakePriorLapses = new Map(
    Array.from(mistakeCurrentLapses.entries()).map(
      ([mistakeId, currentLapses]) => [
        mistakeId,
        Math.max(0, currentLapses - (mistakeAgainCounts.get(mistakeId) ?? 0)),
      ],
    ),
  );

  return reviewLogs.map((reviewLog) => {
    const priorLapses = reviewLog.mistakeId
      ? (mistakePriorLapses.get(reviewLog.mistakeId) ?? 0)
      : 0;

    if (
      reviewLog.itemType === "Mistake" &&
      reviewLog.rating === "Again" &&
      reviewLog.mistakeId
    ) {
      mistakePriorLapses.set(
        reviewLog.mistakeId,
        priorLapses + 1,
      );
    }

    return {
      itemType: reviewLog.itemType,
      rating: reviewLog.rating,
      reviewedAt: reviewLog.reviewedAt,
      mistakeHadPriorLapse:
        reviewLog.itemType === "Mistake" ? priorLapses > 0 : false,
    };
  });
}

export async function getCurrentUserAttempts(): Promise<Attempt[] | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const attempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    orderBy: { createdAt: "asc" },
  });

  return attempts.map(toAppAttempt);
}

export async function getCurrentUserProgress() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  return progressFromAttempts(attempts);
}

export async function getCurrentUserPatternProgress(
  patternId: string,
): Promise<PatternProgress | null> {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  const userProfile = await ensureCurrentUserProfile();
  const progress = progressFromAttempts(attempts);
  const patternInputMap = userProfile
    ? await getPatternMasteryInputMap(userProfile.id)
    : createPatternMasteryInputMap();

  return getPatternProgress(patternId, progress, {
    explanationScores: patternInputMap.get(patternId)?.explanationScores,
    retentionRatings: patternInputMap.get(patternId)?.retentionRatings,
  });
}

export async function getCurrentUserDashboardStats() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return getGamificationStats(attempts);
  }

  const [reviewStats, reviewActivities] = await Promise.all([
    getReviewStats(userProfile.id),
    getReviewXpActivities(userProfile.id),
  ]);

  const stats = getGamificationStats(attempts, {
    reviewActivities,
    clearedDueReviewsToday:
      reviewStats.reviewedTodayCount > 0 && reviewStats.totalDueCount === 0,
  });

  return {
    ...stats,
    xp: await getTotalXP(userProfile.id),
  };
}

function toPlainRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getEvidenceFromMetadata(metadata: Record<string, unknown>): string[] {
  const evidence = metadata.evidence;

  return Array.isArray(evidence)
    ? evidence.filter((item): item is string => typeof item === "string")
    : [];
}

function limitProgressForDashboard(
  progress: UserProgress,
  limit = DASHBOARD_PROGRESS_ATTEMPT_LIMIT,
): UserProgress {
  const attemptLog = progress.attemptLog ?? Object.values(progress.attempts);
  const recentAttempts = attemptLog.slice(-limit);

  return {
    ...progress,
    attemptLog: recentAttempts,
    attempts: recentAttempts.reduce<Record<string, Attempt>>((byProblem, attempt) => {
      byProblem[attempt.problemId] = attempt;
      return byProblem;
    }, {}),
  };
}

async function getDashboardNextBestAction(
  userProfileId: string,
): Promise<DashboardRecommendation | null> {
  let recommendation = await getPrisma().recommendation.findFirst({
    where: {
      userProfileId,
      status: "Active",
    },
    select: {
      id: true,
      title: true,
      reason: true,
      recommendationType: true,
      priority: true,
      targetPatternId: true,
      secondaryPatternId: true,
      problemId: true,
      battleType: true,
      metadata: true,
    },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  if (!recommendation) {
    const { saveRecommendations } = await import("@/lib/recommendations/engine");

    await saveRecommendations(userProfileId);
    recommendation = await getPrisma().recommendation.findFirst({
      where: {
        userProfileId,
        status: "Active",
      },
      select: {
        id: true,
        title: true,
        reason: true,
        recommendationType: true,
        priority: true,
        targetPatternId: true,
        secondaryPatternId: true,
        problemId: true,
        battleType: true,
        metadata: true,
      },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
    });
  }

  if (!recommendation) {
    return null;
  }

  const metadata = toPlainRecord(recommendation.metadata);
  const savedRecommendation: SavedRecommendationForDashboard = {
    id: recommendation.id,
    title: recommendation.title,
    reason: recommendation.reason,
    recommendationType: recommendation.recommendationType,
    priority: recommendation.priority,
    targetPatternId: recommendation.targetPatternId ?? undefined,
    secondaryPatternId: recommendation.secondaryPatternId ?? undefined,
    problemId: recommendation.problemId ?? undefined,
    battleType: recommendation.battleType ?? undefined,
    metadata,
    evidence: getEvidenceFromMetadata(metadata),
  };

  return toDashboardRecommendation(savedRecommendation);
}

async function getDashboardStartingPath(
  userProfileId: string,
): Promise<DashboardStartingPath | null> {
  const plan = await getPrisma().learningPlan.findFirst({
    where: {
      userProfileId,
      title: STARTING_PATH_TITLE,
      status: "Active",
    },
    include: {
      steps: {
        include: {
          targetPattern: { select: { name: true } },
          problem: { select: { title: true } },
        },
        orderBy: [{ status: "asc" }, { dayIndex: "asc" }],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!plan) {
    return null;
  }

  const todayStep =
    plan.steps.find((step) => step.status === "Active") ??
    plan.steps.find((step) => step.status === "Pending") ??
    plan.steps[0] ??
    null;

  return {
    planId: plan.id,
    title: plan.title,
    whyChosen: plan.goal,
    todayStep: todayStep
      ? {
          id: todayStep.id,
          dayIndex: todayStep.dayIndex,
          stepType: todayStep.stepType,
          title: todayStep.title,
          targetPatternId: todayStep.targetPatternId,
          targetPatternName: todayStep.targetPattern?.name ?? null,
          problemId: todayStep.problemId,
          problemTitle: todayStep.problem?.title ?? null,
          dueDate: todayStep.dueDate.toISOString(),
        }
      : null,
  };
}

export async function getCurrentUserProgressSnapshot(
  patternId?: string,
): Promise<UserProgressSnapshot> {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return {
      progress: null,
      dashboardStats: null,
      patternProgress: null,
      patternProgressById: null,
      reviewStats: null,
      dailyQuests: null,
      dashboardGamification: null,
      nextBestAction: null,
      onboardingState: null,
      startingPath: null,
    };
  }

  const progress = progressFromAttempts(attempts);
  const userProfile = await ensureCurrentUserProfile();
  const [
    reviewStats,
    reviewActivities,
    patternInputMap,
    dailyQuests,
    onboardingState,
  ] = userProfile
    ? await Promise.all([
        getReviewStats(userProfile.id),
        getReviewXpActivities(userProfile.id),
        getPatternMasteryInputMap(userProfile.id),
        generateDailyQuests(userProfile.id),
        getPrisma().onboardingState.findUnique({
          where: { userProfileId: userProfile.id },
          select: {
            status: true,
            currentStep: true,
            completedAt: true,
            skippedAt: true,
          },
        }),
      ])
    : [null, [], createPatternMasteryInputMap(), null, null];
  const patternProgressById = getPatternProgressById(progress, patternInputMap);

  const dashboardStats = getGamificationStats(attempts, {
    reviewActivities,
    clearedDueReviewsToday:
      reviewStats !== null &&
      reviewStats.reviewedTodayCount > 0 &&
      reviewStats.totalDueCount === 0,
  });
  const [totalXp, dashboardGamification, nextBestAction, startingPath] = userProfile
    ? await Promise.all([
        getTotalXP(userProfile.id),
        getDashboardGamificationData({
          userProfileId: userProfile.id,
          attempts,
          patternProgressById,
        }),
        getDashboardNextBestAction(userProfile.id),
        getDashboardStartingPath(userProfile.id),
      ])
    : [dashboardStats.xp, null, null, null];

  return {
    progress: limitProgressForDashboard(progress),
    dashboardStats: userProfile
      ? {
          ...dashboardStats,
          xp: totalXp,
        }
      : dashboardStats,
    patternProgress: patternId
      ? (patternProgressById[patternId] ?? null)
      : null,
    patternProgressById,
    reviewStats: reviewStats
      ? {
          ...reviewStats,
          memoryStreak: calculateMemoryStreak({
            attempts,
            reviewDates: reviewActivities.map(
              (reviewActivity) => new Date(reviewActivity.reviewedAt),
            ),
          }),
        }
      : null,
    dailyQuests,
    dashboardGamification,
    nextBestAction,
    onboardingState: onboardingState
      ? {
          status: onboardingState.status,
          currentStep: onboardingState.currentStep,
          completedAt: onboardingState.completedAt?.toISOString() ?? null,
          skippedAt: onboardingState.skippedAt?.toISOString() ?? null,
      }
      : null,
    startingPath,
  };
}

export async function createAttemptForUserProfileWithClient(
  client: Prisma.TransactionClient,
  userProfileId: string,
  input: CreateAttemptInput,
): Promise<Attempt> {
  const [problem, selectedPattern] = await Promise.all([
    client.problem.findUnique({
      where: { id: input.problemId },
      include: {
        problemPatterns: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    }),
    client.pattern.findUnique({
      where: { id: input.selectedPatternId },
    }),
  ]);

  const correctPatternId = problem?.problemPatterns[0]?.patternId;

  if (!problem || !correctPatternId) {
    throw new Error("Problem seed data was not found.");
  }

  if (!selectedPattern) {
    throw new Error("Selected pattern was not found.");
  }

  const createdAt = normalizeCreatedAt(input.createdAt);
  const attempt = await client.attempt.create({
    data: {
      userProfileId,
      problemId: input.problemId,
      selectedPatternId: input.selectedPatternId,
      correctPatternId,
      wasPatternCorrect: input.selectedPatternId === correctPatternId,
      solvedStatus: toPrismaSolvedStatus(input.solvedStatus),
      timeSpentMinutes: input.timeSpentMinutes,
      confidence: input.confidence,
      reflection: input.reflection.trim(),
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });
  const appAttempt = toAppAttempt(attempt);

  if (input.codeSubmissionId?.trim()) {
    const codeSubmissionId = input.codeSubmissionId.trim();
    const linkedSubmission = await client.codeSubmission.updateMany({
      where: {
        id: codeSubmissionId,
        userProfileId,
        problemId: input.problemId,
        attemptId: null,
        interviewRoundId: null,
        battleRoundId: null,
      },
      data: {
        attemptId: attempt.id,
      },
    });

    if (linkedSubmission.count > 0) {
      await client.debugInsight.updateMany({
        where: {
          userProfileId,
          attemptId: null,
          codeRun: {
            codeSubmissionId,
          },
        },
        data: {
          attemptId: attempt.id,
        },
      });
    }
  }

  await createGameEventWithClient(
    client,
    userProfileId,
    "AttemptCompleted",
    calculateAttemptGameXp(appAttempt),
    "Practice attempt completed",
    {
      attemptId: attempt.id,
      problemId: attempt.problemId,
      selectedPatternId: attempt.selectedPatternId,
      correctPatternId: attempt.correctPatternId,
      wasPatternCorrect: attempt.wasPatternCorrect,
      solvedStatus: appAttempt.solvedStatus,
    },
  );
  await trackEvent({
    client,
    eventName: AnalyticsEvents.AttemptCompleted,
    userProfileId,
    properties: {
      attemptId: attempt.id,
      problemId: attempt.problemId,
      selectedPatternId: attempt.selectedPatternId,
      correctPatternId: attempt.correctPatternId,
      wasPatternCorrect: attempt.wasPatternCorrect,
      solvedStatus: appAttempt.solvedStatus,
      confidence: attempt.confidence,
      timeSpentMinutes: attempt.timeSpentMinutes,
      linkedCodeSubmission: Boolean(input.codeSubmissionId?.trim()),
    },
  });
  await updatePatternConfusionOnAttemptWithClient(
    client,
    userProfileId,
    attempt.selectedPatternId,
    attempt.correctPatternId,
    attempt.createdAt,
  );
  await updateQuestProgress(client, userProfileId, {
    eventType: "AttemptCompleted",
    attemptId: attempt.id,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: appAttempt.solvedStatus,
  });
  await checkAchievementsWithClient(client, userProfileId);

  return appAttempt;
}

export async function createAttemptForUserProfile(
  userProfileId: string,
  input: CreateAttemptInput,
): Promise<Attempt> {
  return getPrisma().$transaction((tx) =>
    createAttemptForUserProfileWithClient(tx, userProfileId, input),
  );
}

export async function createCurrentUserAttempt(
  input: CreateAttemptInput,
): Promise<Attempt | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  return createAttemptForUserProfile(userProfile.id, input);
}

export async function importCurrentUserAttempts(
  inputs: CreateAttemptInput[],
): Promise<ImportAttemptsResult | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const existingAttempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    select: {
      problemId: true,
      selectedPatternId: true,
      solvedStatus: true,
      createdAt: true,
    },
  });
  const seen = new Set(
    existingAttempts.map((attempt) =>
      getImportKey({
        problemId: attempt.problemId,
        selectedPatternId: attempt.selectedPatternId,
        solvedStatus: toSolvedStatus(attempt.solvedStatus),
        createdAt: attempt.createdAt.toISOString(),
      }),
    ),
  );
  let importedCount = 0;
  let skippedCount = 0;

  for (const input of inputs) {
    const key = getImportKey(input);

    if (seen.has(key)) {
      skippedCount += 1;
      continue;
    }

    try {
      const importedAttempt = await createAttemptForUserProfile(
        userProfile.id,
        input,
      );
      seen.add(key);
      seen.add(getImportKey(importedAttempt));
      importedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  return { importedCount, skippedCount };
}
