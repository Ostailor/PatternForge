"use server";

import { GameEventType } from "@/generated/prisma/enums";
import { buildContrastDrill } from "@/lib/drills/contrast";
import type { ContrastDrillAnswer } from "@/lib/drills/contrast";
import { createGameEvent } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import {
  createRecommendationFeedback,
  markRecommendationCompleted,
} from "@/lib/recommendations/engine";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type SaveContrastDrillResultInput = {
  selectedPatternId: string;
  correctPatternId: string;
  answers: ContrastDrillAnswer[];
  accuracy: number;
  recommendationId?: string;
};

export type SaveContrastDrillResult =
  | { status: "saved" }
  | { status: "unauthenticated" }
  | { status: "invalid"; message: string };

function validateSaveInput(input: SaveContrastDrillResultInput): string | null {
  const drill = buildContrastDrill(input.selectedPatternId, input.correctPatternId);

  if (!drill) {
    return "Contrast drill pair is invalid.";
  }

  if (!Array.isArray(input.answers) || input.answers.length === 0) {
    return "At least one answered card is required.";
  }

  if (
    !Number.isInteger(input.accuracy) ||
    input.accuracy < 0 ||
    input.accuracy > 100
  ) {
    return "Accuracy must be between 0 and 100.";
  }

  const validCardIds = new Set(drill.cards.map((card) => card.id));

  if (input.answers.some((answer) => !validCardIds.has(answer.cardId))) {
    return "Answers include a card outside this drill.";
  }

  return null;
}

export async function saveContrastDrillResultAction(
  input: SaveContrastDrillResultInput,
): Promise<SaveContrastDrillResult> {
  const validationError = validateSaveInput(input);

  if (validationError) {
    return { status: "invalid", message: validationError };
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated" };
  }

  const contrastDrillId = `${input.selectedPatternId}:${input.correctPatternId}:${input.answers
    .map((answer) => `${answer.cardId}-${answer.selectedPatternId}`)
    .join("|")}`;

  await createGameEvent(
    userProfile.id,
    GameEventType.ContrastDrillCompleted,
    input.accuracy >= 80 ? 20 : 10,
    `Completed contrast drill with ${input.accuracy}% accuracy.`,
    {
      contrastDrillId,
      selectedPatternId: input.selectedPatternId,
      correctPatternId: input.correctPatternId,
      accuracy: input.accuracy,
      answeredCount: input.answers.length,
    },
  );

  if (input.recommendationId) {
    const recommendation = await getPrisma().recommendation.findFirst({
      where: {
        id: input.recommendationId,
        userProfileId: userProfile.id,
      },
      select: { id: true },
    });

    if (recommendation) {
      await markRecommendationCompleted(userProfile.id, recommendation.id);
      await createRecommendationFeedback(
        userProfile.id,
        recommendation.id,
        "Helpful",
      );
    }
  }

  return { status: "saved" };
}
