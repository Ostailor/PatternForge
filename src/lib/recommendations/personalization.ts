import type { RecommendationFeedbackType } from "@/generated/prisma/enums";

import type { RecommendationCandidate, RecommendationType } from "./types";

export type RecommendationDifficultyPreference = "default" | "easier" | "harder";

export type RecommendationFeedbackSignal = {
  feedbackType: RecommendationFeedbackType;
  recommendationType: RecommendationType;
  targetPatternId?: string | null;
  secondaryPatternId?: string | null;
  createdAt: Date;
};

export type RecommendationFeedbackProfile = {
  suppressedRecommendationTypes: Set<RecommendationType>;
  exactDifficultyPreferences: Map<string, RecommendationDifficultyPreference>;
  typeDifficultyPreferences: Map<RecommendationType, RecommendationDifficultyPreference>;
};

const tunableRecommendationTypes = new Set<RecommendationType>([
  "FocusPattern",
  "RetryProblem",
  "ContrastDrill",
  "DailyForge",
  "AIReviewFollowUp",
  "MockInterview",
  "FocusedInterview",
  "WeaknessRepairInterview",
  "DebugDrill",
  "TestingPractice",
  "ImplementationPractice",
]);

function makeExactKey(
  recommendationType: RecommendationType,
  targetPatternId?: string | null,
): string | null {
  return targetPatternId ? `${recommendationType}:${targetPatternId}` : null;
}

function toDifficultyPreference(
  feedbackType: RecommendationFeedbackType,
): RecommendationDifficultyPreference | null {
  switch (feedbackType) {
    case "TooEasy":
      return "harder";
    case "TooHard":
      return "easier";
    default:
      return null;
  }
}

export function deriveRecommendationFeedbackProfile(
  signals: RecommendationFeedbackSignal[],
): RecommendationFeedbackProfile {
  const sortedSignals = signals
    .slice()
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const latestFeedbackByType = new Map<
    RecommendationType,
    RecommendationFeedbackType
  >();
  const exactDifficultyPreferences = new Map<
    string,
    RecommendationDifficultyPreference
  >();
  const typeDifficultyPreferences = new Map<
    RecommendationType,
    RecommendationDifficultyPreference
  >();

  for (const signal of sortedSignals) {
    if (!latestFeedbackByType.has(signal.recommendationType)) {
      latestFeedbackByType.set(signal.recommendationType, signal.feedbackType);
    }

    const difficultyPreference = toDifficultyPreference(signal.feedbackType);

    if (!difficultyPreference) {
      continue;
    }

    const exactKey = makeExactKey(
      signal.recommendationType,
      signal.targetPatternId,
    );

    if (exactKey && !exactDifficultyPreferences.has(exactKey)) {
      exactDifficultyPreferences.set(exactKey, difficultyPreference);
    }

    if (!typeDifficultyPreferences.has(signal.recommendationType)) {
      typeDifficultyPreferences.set(
        signal.recommendationType,
        difficultyPreference,
      );
    }
  }

  return {
    suppressedRecommendationTypes: new Set(
      Array.from(latestFeedbackByType.entries())
        .filter(([, feedbackType]) => feedbackType === "NotRelevant")
        .map(([recommendationType]) => recommendationType),
    ),
    exactDifficultyPreferences,
    typeDifficultyPreferences,
  };
}

export function getDifficultyPreferenceForRecommendation(
  profile: RecommendationFeedbackProfile,
  recommendationType: RecommendationType,
  targetPatternId?: string | null,
): RecommendationDifficultyPreference {
  const exactKey = makeExactKey(recommendationType, targetPatternId);

  if (exactKey) {
    const exactPreference = profile.exactDifficultyPreferences.get(exactKey);

    if (exactPreference) {
      return exactPreference;
    }
  }

  return profile.typeDifficultyPreferences.get(recommendationType) ?? "default";
}

export function applyRecommendationFeedbackPersonalization(
  recommendations: RecommendationCandidate[],
  profile: RecommendationFeedbackProfile,
): RecommendationCandidate[] {
  return recommendations
    .filter(
      (recommendation) =>
        recommendation.recommendationType === "DailyForge" ||
        !profile.suppressedRecommendationTypes.has(
          recommendation.recommendationType,
        ),
    )
    .map((recommendation) => {
      if (!tunableRecommendationTypes.has(recommendation.recommendationType)) {
        return recommendation;
      }

      const difficultyPreference = getDifficultyPreferenceForRecommendation(
        profile,
        recommendation.recommendationType,
        recommendation.targetPatternId,
      );

      if (difficultyPreference === "default") {
        return recommendation;
      }

      const evidence =
        difficultyPreference === "harder"
          ? "Recent feedback marked similar recommendations too easy"
          : "Recent feedback marked similar recommendations too hard";
      const reason =
        difficultyPreference === "harder"
          ? `${recommendation.reason} Similar recommendations were marked too easy, so this one nudges difficulty up.`
          : `${recommendation.reason} Similar recommendations were marked too hard, so this starts lighter and favors review first.`;

      return {
        ...recommendation,
        reason,
        metadata: {
          ...recommendation.metadata,
          difficultyPreference,
          personalizedFromFeedback: true,
          recommendReviewFirst: difficultyPreference === "easier",
        },
        evidence: [...recommendation.evidence, evidence],
      };
    });
}
