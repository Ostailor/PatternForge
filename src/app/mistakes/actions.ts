"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function readMistakeId(formData: FormData): string {
  const mistakeId = formData.get("mistakeId");

  return typeof mistakeId === "string" ? mistakeId.trim() : "";
}

export async function archiveMistakeAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  const mistakeId = readMistakeId(formData);

  if (!mistakeId) {
    return;
  }

  await getPrisma().mistake.updateMany({
    where: {
      id: mistakeId,
      userProfileId: userProfile.id,
      status: "active",
    },
    data: {
      status: "archived",
    },
  });

  revalidatePath("/mistakes");
  revalidatePath("/review");
}

export async function reviewMistakeNowAction(formData: FormData) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return;
  }

  const mistakeId = readMistakeId(formData);

  if (!mistakeId) {
    return;
  }

  await getPrisma().mistake.updateMany({
    where: {
      id: mistakeId,
      userProfileId: userProfile.id,
      status: "active",
    },
    data: {
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/mistakes");
  revalidatePath("/review");
  redirect("/review");
}
