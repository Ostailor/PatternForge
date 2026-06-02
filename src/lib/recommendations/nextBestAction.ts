import type { RecommendationCandidate } from "./types";

function identityPart(value: string | undefined): string {
  return value?.trim() || "none";
}

export function getRecommendationDedupeKey(
  recommendation: RecommendationCandidate,
): string {
  return [
    recommendation.recommendationType,
    identityPart(recommendation.targetPatternId),
    identityPart(recommendation.secondaryPatternId),
    identityPart(recommendation.problemId),
    identityPart(recommendation.battleType),
  ].join("|");
}

export function sortRecommendations(
  recommendations: RecommendationCandidate[],
): RecommendationCandidate[] {
  return recommendations.slice().sort((a, b) => {
    const priorityDelta = a.priority - b.priority;

    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    const evidenceDelta = b.evidence.length - a.evidence.length;

    if (evidenceDelta !== 0) {
      return evidenceDelta;
    }

    return a.title.localeCompare(b.title);
  });
}

export function selectNextBestAction(
  recommendations: RecommendationCandidate[],
): RecommendationCandidate | null {
  return sortRecommendations(recommendations)[0] ?? null;
}
