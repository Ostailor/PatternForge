import type { BattleType } from "@/generated/prisma/enums";
import type { PatternConfusionInsight } from "@/lib/recommendations/patternConfusion";

import type {
  PatternWeaknessScore,
  RecommendationCandidate,
  RecommendationType,
} from "./types";

function toRecommendationType(
  actionType: PatternWeaknessScore["recommendedActionType"],
): RecommendationType {
  return actionType;
}

export function buildDueReviewRecommendation({
  dueFlashcardsCount,
  dueMistakesCount,
}: {
  dueFlashcardsCount: number;
  dueMistakesCount: number;
}): RecommendationCandidate {
  const totalDueCount = dueFlashcardsCount + dueMistakesCount;

  return {
    title: "Clear Daily Review",
    reason: `${totalDueCount} review item${totalDueCount === 1 ? "" : "s"} are due. Clear memory work before adding new practice.`,
    priority: 1,
    recommendationType: "DueReview",
    metadata: {
      dueFlashcardsCount,
      dueMistakesCount,
      dueCount: totalDueCount,
    },
    evidence: [
      `${dueFlashcardsCount} due flashcards`,
      `${dueMistakesCount} due mistakes`,
    ],
  };
}

export function buildActiveBattleRecommendation({
  battleId,
  title,
  battleType,
  targetPatternId,
}: {
  battleId: string;
  title: string;
  battleType: BattleType;
  targetPatternId: string | null;
}): RecommendationCandidate {
  return {
    title: `Resume ${title}`,
    reason: "An active battle is already in progress. Resume it before starting another recommendation.",
    priority: 2,
    recommendationType:
      battleType === "ReviewGauntlet" ? "ReviewGauntlet" : "BossBattle",
    targetPatternId: targetPatternId ?? undefined,
    battleType,
    metadata: {
      battleId,
      action: "resume",
    },
    evidence: [`Active ${battleType} battle is available`],
  };
}

export function buildActiveInterviewRecommendation({
  interviewId,
  title,
}: {
  interviewId: string;
  title: string;
}): RecommendationCandidate {
  return {
    title: `Resume ${title}`,
    reason: "An active interview is already in progress. Resume it before starting another recommendation.",
    priority: 2,
    recommendationType: "MockInterview",
    metadata: {
      interviewId,
      action: "resume",
    },
    evidence: ["Active interview is available"],
  };
}

export function buildWeakPatternRecommendation({
  weakness,
  patternName,
  problemId,
}: {
  weakness: PatternWeaknessScore;
  patternName: string;
  problemId?: string;
}): RecommendationCandidate {
  return {
    title: `Focus ${patternName}`,
    reason: weakness.primaryReason,
    priority: 3,
    recommendationType: toRecommendationType(weakness.recommendedActionType),
    targetPatternId: weakness.patternId,
    problemId,
    metadata: {
      weaknessScore: weakness.weaknessScore,
      severity: weakness.severity,
    },
    evidence: weakness.evidence,
  };
}

export function buildConfusionRecommendation(
  insight: PatternConfusionInsight,
  problemId?: string,
): RecommendationCandidate {
  return {
    title: `${insight.selectedPatternName} vs ${insight.correctPatternName}`,
    reason: insight.explanation,
    priority: 4,
    recommendationType: "ContrastDrill",
    targetPatternId: insight.correctPatternId,
    secondaryPatternId: insight.selectedPatternId,
    problemId,
    metadata: {
      count: insight.count,
      lastSeenAt: insight.lastSeenAt,
      recommendedContrastDrill: insight.recommendedContrastDrill,
    },
    evidence: [
      `${insight.count} recorded confusion${insight.count === 1 ? "" : "s"}`,
      `Last seen ${insight.lastSeenAt}`,
    ],
  };
}

export function buildFailedBattleRecommendation({
  battleId,
  battleTitle,
  result,
  targetPatternId,
  patternName,
  problemId,
}: {
  battleId: string;
  battleTitle: string;
  result: "Defeat" | "PartialVictory";
  targetPatternId?: string;
  patternName?: string;
  problemId?: string;
}): RecommendationCandidate {
  const isDefeat = result === "Defeat";

  return {
    title: isDefeat
      ? "Review failed battle patterns"
      : `Refine ${patternName ?? "recent battle pattern"}`,
    reason: isDefeat
      ? `${battleTitle} ended in defeat. Run a review gauntlet before the next pressure test.`
      : `${battleTitle} was a partial victory. Focus the target pattern before retrying.`,
    priority: 5,
    recommendationType: isDefeat ? "ReviewGauntlet" : "FocusPattern",
    targetPatternId,
    problemId,
    metadata: {
      battleId,
      result,
    },
    evidence: [`Recent battle result: ${result}`],
  };
}

export function buildMockInterviewRecommendation({
  title,
  reason,
  evidence,
  metadata,
}: {
  title: string;
  reason: string;
  evidence: string[];
  metadata: Record<string, unknown>;
}): RecommendationCandidate {
  return {
    title,
    reason,
    priority: 4,
    recommendationType: "MockInterview",
    metadata,
    evidence,
  };
}

export function buildFocusedInterviewRecommendation({
  patternId,
  patternName,
  reason,
  evidence,
  metadata,
}: {
  patternId: string;
  patternName: string;
  reason: string;
  evidence: string[];
  metadata: Record<string, unknown>;
}): RecommendationCandidate {
  return {
    title: `Start focused ${patternName} interview`,
    reason,
    priority: 4,
    recommendationType: "FocusedInterview",
    targetPatternId: patternId,
    metadata,
    evidence,
  };
}

export function buildWeaknessRepairInterviewRecommendation({
  patternId,
  patternName,
  reason,
  evidence,
  metadata,
}: {
  patternId?: string;
  patternName?: string;
  reason: string;
  evidence: string[];
  metadata: Record<string, unknown>;
}): RecommendationCandidate {
  return {
    title: patternName
      ? `Repair ${patternName} interview weakness`
      : "Start weakness repair interview",
    reason,
    priority: 4,
    recommendationType: "WeaknessRepairInterview",
    targetPatternId: patternId,
    metadata,
    evidence,
  };
}

export function buildLearningPlanStepRecommendation({
  stepId,
  learningPlanId,
  title,
  stepType,
  dueDate,
  targetPatternId,
  problemId,
}: {
  stepId: string;
  learningPlanId: string;
  title: string;
  stepType: string;
  dueDate: Date;
  targetPatternId?: string | null;
  problemId?: string | null;
}): RecommendationCandidate {
  return {
    title,
    reason: "An active learning plan step is due.",
    priority: 6,
    recommendationType: "LearningPlanStep",
    targetPatternId: targetPatternId ?? undefined,
    problemId: problemId ?? undefined,
    metadata: {
      stepId,
      learningPlanId,
      stepType,
      dueDate: dueDate.toISOString(),
    },
    evidence: [`Due ${dueDate.toISOString()}`],
  };
}

export function buildReadyForBossRecommendation({
  patternId,
  patternName,
}: {
  patternId: string;
  patternName: string;
}): RecommendationCandidate {
  return {
    title: `${patternName} Pattern Boss`,
    reason: `${patternName} has strong mastery and retention signals. Pressure test it with a Pattern Boss.`,
    priority: 7,
    recommendationType: "BossBattle",
    targetPatternId: patternId,
    battleType: "PatternBoss",
    metadata: {
      reasonCode: "ready_for_boss",
    },
    evidence: ["Mastery >= 76", "Retention >= 75"],
  };
}

export function buildDailyForgeRecommendation({
  targetPatternId,
  patternName,
  problemId,
}: {
  targetPatternId?: string;
  patternName?: string;
  problemId?: string;
}): RecommendationCandidate {
  return {
    title: "Start Daily Forge",
    reason: patternName
      ? `Start a balanced Daily Forge session with ${patternName} as the focus.`
      : "Start a balanced Daily Forge session.",
    priority: 8,
    recommendationType: "DailyForge",
    targetPatternId,
    problemId,
    metadata: {
      reasonCode: "fallback_daily_forge",
    },
    evidence: ["No higher-priority recommendation is currently available"],
  };
}
