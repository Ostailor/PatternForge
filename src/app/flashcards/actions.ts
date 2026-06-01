"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function readFlashcardId(formData: FormData): string {
  const flashcardId = formData.get("flashcardId");

  return typeof flashcardId === "string" ? flashcardId.trim() : "";
}

export async function archiveFlashcardAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  const flashcardId = readFlashcardId(formData);

  if (!flashcardId) {
    return;
  }

  await getPrisma().flashcard.updateMany({
    where: {
      id: flashcardId,
      userProfileId: userProfile.id,
      status: "active",
    },
    data: {
      status: "archived",
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/review");
}

export async function reviewFlashcardNowAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  const flashcardId = readFlashcardId(formData);

  if (!flashcardId) {
    return;
  }

  await getPrisma().flashcard.updateMany({
    where: {
      id: flashcardId,
      userProfileId: userProfile.id,
      status: "active",
    },
    data: {
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/review");
  redirect("/review");
}
