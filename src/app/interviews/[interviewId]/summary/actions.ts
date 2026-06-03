"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

async function getOwnedCommunicationInsight(insightId: string, userProfileId: string) {
  return getPrisma().communicationInsight.findFirst({
    where: {
      id: insightId,
      userProfileId,
    },
    include: {
      interviewSession: {
        include: {
          rounds: {
            include: {
              attempt: true,
              correctPattern: true,
              problem: true,
            },
            orderBy: {
              roundNumber: "asc",
            },
          },
        },
      },
    },
  });
}

function getInsightPatternContext(
  insight: Awaited<ReturnType<typeof getOwnedCommunicationInsight>>,
) {
  const roundWithAttempt = insight?.interviewSession?.rounds.find(
    (round) => round.attempt,
  );
  const fallbackRound = insight?.interviewSession?.rounds[0] ?? null;
  const round = roundWithAttempt ?? fallbackRound;

  if (!round) {
    return null;
  }

  return {
    attempt: roundWithAttempt?.attempt ?? null,
    problemId: round.problemId,
    patternId: round.correctPatternId,
    patternName: round.correctPattern.name,
    problemTitle: round.problem.title,
  };
}

export async function createFlashcardFromCommunicationInsightAction(
  formData: FormData,
) {
  const userProfile = await ensureCurrentUserProfile();
  const insightId = readString(formData, "insightId");
  const interviewId = readString(formData, "interviewId");

  if (!userProfile || !insightId || !interviewId) {
    redirect("/interviews");
  }

  const insight = await getOwnedCommunicationInsight(insightId, userProfile.id);
  const context = getInsightPatternContext(insight);

  if (!insight || !context) {
    redirect(`/interviews/${interviewId}/summary?voiceAction=invalid`);
  }

  await getPrisma().flashcard.create({
    data: {
      userProfileId: userProfile.id,
      sourceAttemptId: context.attempt?.id,
      patternId: context.patternId,
      front: `How should I improve this interview explanation? ${insight.summary}`,
      back: [
        `Pattern: ${context.patternName}`,
        `Problem: ${context.problemTitle}`,
        `Practice: ${insight.summary}`,
      ].join("\n\n"),
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/review");
  revalidatePath(`/interviews/${interviewId}/summary`);
  redirect(`/interviews/${interviewId}/summary?voiceAction=flashcard-created`);
}

export async function createMistakeFromCommunicationInsightAction(
  formData: FormData,
) {
  const userProfile = await ensureCurrentUserProfile();
  const insightId = readString(formData, "insightId");
  const interviewId = readString(formData, "interviewId");

  if (!userProfile || !insightId || !interviewId) {
    redirect("/interviews");
  }

  const insight = await getOwnedCommunicationInsight(insightId, userProfile.id);
  const context = getInsightPatternContext(insight);

  if (!insight || !context?.attempt) {
    redirect(`/interviews/${interviewId}/summary?voiceAction=mistake-unavailable`);
  }

  await getPrisma().mistake.create({
    data: {
      userProfileId: userProfile.id,
      attemptId: context.attempt.id,
      problemId: context.problemId,
      patternId: context.patternId,
      mistakeType: `Communication: ${insight.insightType}`,
      description: insight.summary,
      correction:
        "Practice a clearer spoken answer that states the signal, invariant, edge cases, and complexity before implementation details.",
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/mistakes");
  revalidatePath("/review");
  revalidatePath(`/interviews/${interviewId}/summary`);
  redirect(`/interviews/${interviewId}/summary?voiceAction=mistake-created`);
}
