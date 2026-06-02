import { patterns } from "@/data/patterns";
import type {
  BattleType,
  RecommendationFeedbackType,
} from "@/generated/prisma/enums";
import type { RecommendationType } from "@/lib/recommendations/types";

export type SavedRecommendationForDashboard = {
  id: string;
  title: string;
  reason: string;
  recommendationType: RecommendationType;
  priority: number;
  targetPatternId?: string;
  secondaryPatternId?: string;
  problemId?: string;
  battleType?: BattleType;
  metadata: Record<string, unknown>;
  evidence: string[];
};

export type DashboardRecommendation = {
  id: string;
  title: string;
  recommendationType: RecommendationType;
  recommendationTypeLabel: string;
  targetPatternId?: string;
  targetPatternName?: string;
  secondaryPatternId?: string;
  secondaryPatternName?: string;
  reason: string;
  evidence: string[];
  estimatedMinutes: number;
  primaryCta: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href: string;
  };
  feedbackOptions: RecommendationFeedbackType[];
};

const DEFAULT_ESTIMATED_MINUTES = 25;
const FEEDBACK_OPTIONS: RecommendationFeedbackType[] = [
  "Helpful",
  "TooEasy",
  "TooHard",
  "NotRelevant",
];

function getPatternName(patternId: string | undefined): string | undefined {
  if (!patternId) {
    return undefined;
  }

  return patterns.find((pattern) => pattern.id === patternId)?.name;
}

function getMetadataNumber(
  metadata: Record<string, unknown>,
  key: string,
): number | null {
  const value = metadata[key];

  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | null {
  const value = metadata[key];

  return typeof value === "string" && value.trim() ? value : null;
}

function getRecommendationTypeLabel(type: RecommendationType): string {
  switch (type) {
    case "DueReview":
      return "Due Review";
    case "FocusPattern":
      return "Focus Pattern";
    case "ContrastDrill":
      return "Contrast Drill";
    case "RetryProblem":
      return "Retry Problem";
    case "BossBattle":
      return "Boss Battle";
    case "ReviewGauntlet":
      return "Review Gauntlet";
    case "AIReviewFollowUp":
      return "AI Review Follow-up";
    case "LearningPlanStep":
      return "Learning Plan Step";
    case "MockInterview":
      return "Mock Interview";
    case "FocusedInterview":
      return "Focused Interview";
    case "WeaknessRepairInterview":
      return "Weakness Repair Interview";
    case "DailyForge":
      return "Daily Forge";
  }
}

function getEstimatedMinutes(
  recommendation: SavedRecommendationForDashboard,
): number {
  switch (recommendation.recommendationType) {
    case "DueReview": {
      const dueCount =
        getMetadataNumber(recommendation.metadata, "dueCount") ??
        (getMetadataNumber(recommendation.metadata, "dueFlashcardsCount") ?? 0) +
          (getMetadataNumber(recommendation.metadata, "dueMistakesCount") ?? 0);

      return Math.min(15, Math.max(6, dueCount * 2));
    }
    case "ContrastDrill":
      return 28;
    case "BossBattle":
      return 35;
    case "ReviewGauntlet":
      return 30;
    case "LearningPlanStep":
      return 20;
    case "MockInterview":
      return 35;
    case "FocusedInterview":
      return 40;
    case "WeaknessRepairInterview":
      return 40;
    case "DailyForge":
      return 35;
    case "FocusPattern":
    case "RetryProblem":
    case "AIReviewFollowUp":
      return DEFAULT_ESTIMATED_MINUTES;
  }
}

function getPrimaryCta(recommendation: SavedRecommendationForDashboard): {
  label: string;
  href: string;
} {
  switch (recommendation.recommendationType) {
    case "DueReview":
      return { label: "Start Daily Review", href: "/review" };
    case "MockInterview": {
      const interviewId = getMetadataString(recommendation.metadata, "interviewId");
      const action = getMetadataString(recommendation.metadata, "action");

      return {
        label: action === "resume" && interviewId ? "Resume Interview" : "Start Mock Interview",
        href:
          action === "resume" && interviewId
            ? `/interviews/${interviewId}`
            : "/interviews",
      };
    }
    case "FocusedInterview":
      return { label: "Start Focused Interview", href: "/interviews" };
    case "WeaknessRepairInterview":
      return { label: "Start Weakness Repair Interview", href: "/interviews" };
    case "ContrastDrill":
      return {
        label: "Start Contrast Drill",
        href:
          recommendation.secondaryPatternId && recommendation.targetPatternId
          ? `/drills/contrast/${recommendation.secondaryPatternId}/${recommendation.targetPatternId}`
          : recommendation.targetPatternId
            ? `/forge?pattern=${recommendation.targetPatternId}`
          : "/forge",
      };
    case "BossBattle":
      return { label: "Start Boss Battle", href: "/battles" };
    case "ReviewGauntlet":
      return { label: "Start Review Gauntlet", href: "/battles" };
    case "LearningPlanStep":
      return recommendation.problemId
        ? {
            label: "Start Plan Step",
            href: `/problems/${recommendation.problemId}`,
          }
        : { label: "Start Plan Step", href: "/forge" };
    case "DailyForge":
      return { label: "Start Daily Forge", href: "/forge" };
    case "RetryProblem":
      return recommendation.problemId
        ? {
            label: "Retry Problem",
            href: `/problems/${recommendation.problemId}`,
          }
        : {
            label: "Start Focused Forge",
            href: recommendation.targetPatternId
              ? `/forge?pattern=${recommendation.targetPatternId}`
              : "/forge",
          };
    case "AIReviewFollowUp":
    case "FocusPattern":
      return {
        label: "Start Focused Forge",
        href: recommendation.targetPatternId
          ? `/forge?pattern=${recommendation.targetPatternId}`
          : "/forge",
      };
  }
}

function getSecondaryCta(
  recommendation: SavedRecommendationForDashboard,
): DashboardRecommendation["secondaryCta"] {
  if (recommendation.problemId && recommendation.recommendationType !== "RetryProblem") {
    return {
      label: "Open Problem",
      href: `/problems/${recommendation.problemId}`,
    };
  }

  if (
    recommendation.recommendationType === "MockInterview" ||
    recommendation.recommendationType === "FocusedInterview" ||
    recommendation.recommendationType === "WeaknessRepairInterview"
  ) {
    return {
      label: "Interview History",
      href: "/interviews/history",
    };
  }

  if (recommendation.targetPatternId) {
    return {
      label: "View Pattern",
      href: `/patterns/${recommendation.targetPatternId}`,
    };
  }

  if (recommendation.recommendationType !== "DailyForge") {
    return {
      label: "Open Daily Forge",
      href: "/forge",
    };
  }

  return {
    label: "View Pattern Map",
    href: "/patterns",
  };
}

export function toDashboardRecommendation(
  recommendation: SavedRecommendationForDashboard,
): DashboardRecommendation {
  return {
    id: recommendation.id,
    title: recommendation.title,
    recommendationType: recommendation.recommendationType,
    recommendationTypeLabel: getRecommendationTypeLabel(
      recommendation.recommendationType,
    ),
    targetPatternId: recommendation.targetPatternId,
    targetPatternName: getPatternName(recommendation.targetPatternId),
    secondaryPatternId: recommendation.secondaryPatternId,
    secondaryPatternName: getPatternName(recommendation.secondaryPatternId),
    reason: recommendation.reason,
    evidence: recommendation.evidence.slice(0, 4),
    estimatedMinutes: getEstimatedMinutes(recommendation),
    primaryCta: getPrimaryCta(recommendation),
    secondaryCta: getSecondaryCta(recommendation),
    feedbackOptions: FEEDBACK_OPTIONS,
  };
}
