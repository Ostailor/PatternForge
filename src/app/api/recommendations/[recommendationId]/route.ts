import { type NextRequest, NextResponse } from "next/server";

import {
  RecommendationFeedbackType,
  type RecommendationFeedbackType as RecommendationFeedbackTypeValue,
} from "@/generated/prisma/enums";
import {
  createRecommendationFeedback,
  markRecommendationAccepted,
  markRecommendationCompleted,
} from "@/lib/recommendations/engine";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type RecommendationAction = "accept" | "complete" | "dismiss" | "feedback";

type RecommendationActionBody = {
  action?: RecommendationAction;
  feedbackType?: string;
  note?: string;
};

const feedbackTypes = new Set<string>(Object.values(RecommendationFeedbackType));

async function parseBody(request: Request): Promise<RecommendationActionBody> {
  try {
    const body = (await request.json()) as RecommendationActionBody;

    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<unknown> },
) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = (await context.params) as { recommendationId?: string };
  const recommendationId = params.recommendationId?.trim();

  if (!recommendationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await parseBody(request);

  switch (body.action) {
    case "accept": {
      const result = await markRecommendationAccepted(
        userProfile.id,
        recommendationId,
      );

      return NextResponse.json(result, {
        status: result.status === "updated" ? 200 : 404,
      });
    }
    case "complete": {
      const result = await markRecommendationCompleted(
        userProfile.id,
        recommendationId,
      );

      return NextResponse.json(result, {
        status: result.status === "updated" ? 200 : 404,
      });
    }
    case "dismiss": {
      const result = await createRecommendationFeedback(
        userProfile.id,
        recommendationId,
        "Dismissed",
        body.note,
      );

      return NextResponse.json(result, {
        status: result.status === "recorded" ? 200 : 404,
      });
    }
    case "feedback": {
      if (!body.feedbackType || !feedbackTypes.has(body.feedbackType)) {
        return NextResponse.json(
          { error: "Invalid feedback type" },
          { status: 400 },
        );
      }

      const result = await createRecommendationFeedback(
        userProfile.id,
        recommendationId,
        body.feedbackType as RecommendationFeedbackTypeValue,
        body.note,
      );

      return NextResponse.json(result, {
        status: result.status === "recorded" ? 200 : 404,
      });
    }
    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}
