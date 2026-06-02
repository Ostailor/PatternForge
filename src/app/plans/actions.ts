"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createLearningPlanForCurrentUser,
  parseLearningPlanType,
  updateLearningPlanStepForCurrentUser,
} from "@/lib/learning-plans/service";

function readString(formData: FormData, key: string): string {
  const value = formData.get(key);

  return typeof value === "string" ? value.trim() : "";
}

export async function createLearningPlanAction(formData: FormData) {
  const planType = parseLearningPlanType(readString(formData, "planType"));
  const targetPatternId = readString(formData, "targetPatternId");

  if (!planType) {
    redirect("/plans?error=invalid");
  }

  const result = await createLearningPlanForCurrentUser({
    planType,
    targetPatternId: targetPatternId || undefined,
  });

  if (result.status === "created") {
    revalidatePath("/plans");
    redirect(`/plans/${result.planId}`);
  }

  redirect(
    `/plans?error=${result.status === "unauthenticated" ? "signin" : "invalid"}`,
  );
}

export async function completeLearningPlanStepAction(formData: FormData) {
  const planId = readString(formData, "planId");
  const stepId = readString(formData, "stepId");

  await updateLearningPlanStepForCurrentUser({
    planId,
    stepId,
    status: "Completed",
  });

  revalidatePath(`/plans/${planId}`);
}

export async function skipLearningPlanStepAction(formData: FormData) {
  const planId = readString(formData, "planId");
  const stepId = readString(formData, "stepId");

  await updateLearningPlanStepForCurrentUser({
    planId,
    stepId,
    status: "Skipped",
  });

  revalidatePath(`/plans/${planId}`);
}
