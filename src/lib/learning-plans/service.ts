import "server-only";

import { getPatternConfusions } from "@/lib/analytics/confusionMetrics";
import { getPatternMetrics } from "@/lib/analytics/patternMetrics";
import { getUserLearningMetrics } from "@/lib/analytics/userMetrics";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import { generateLearningPlanDraft } from "./generator";
import type { LearningPlanDraft, LearningPlanType } from "./types";

export type LearningPlanListItem = {
  id: string;
  title: string;
  goal: string;
  status: string;
  startDate: string;
  endDate: string | null;
  completedSteps: number;
  totalSteps: number;
};

export type LearningPlanDetail = LearningPlanListItem & {
  steps: Array<{
    id: string;
    dayIndex: number;
    stepType: string;
    title: string;
    targetPatternId: string | null;
    targetPatternName: string | null;
    problemId: string | null;
    problemTitle: string | null;
    targetCount: number | null;
    status: string;
    dueDate: string;
    completedAt: string | null;
  }>;
};

export type CreateLearningPlanInput = {
  planType: LearningPlanType;
  targetPatternId?: string;
  startDate?: Date;
};

export type CreateLearningPlanResult =
  | { status: "created"; planId: string }
  | { status: "unauthenticated" }
  | { status: "invalid"; message: string };

export type StepUpdateResult =
  | { status: "updated" }
  | { status: "unauthenticated" }
  | { status: "not_found" };

function isValidPlanType(value: string): value is LearningPlanType {
  return [
    "InterviewPrepSprint",
    "MasterPattern",
    "WeaknessRepair",
    "MaintenanceMode",
  ].includes(value);
}

export function parseLearningPlanType(value: string): LearningPlanType | null {
  return isValidPlanType(value) ? value : null;
}

async function buildPlanDraftForUser(
  userProfileId: string,
  input: CreateLearningPlanInput,
): Promise<LearningPlanDraft> {
  const [patternMetrics, confusions, userMetrics] = await Promise.all([
    getPatternMetrics(userProfileId),
    getPatternConfusions(userProfileId),
    getUserLearningMetrics(userProfileId),
  ]);

  return generateLearningPlanDraft({
    planType: input.planType,
    startDate: input.startDate ?? new Date(),
    targetPatternId: input.targetPatternId,
    patternMetrics,
    confusions,
    userMetrics,
  });
}

export async function createLearningPlanForCurrentUser(
  input: CreateLearningPlanInput,
): Promise<CreateLearningPlanResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated" };
  }

  if (input.planType === "MasterPattern" && !input.targetPatternId) {
    return {
      status: "invalid",
      message: "A target pattern is required for Master a Pattern.",
    };
  }

  const draft = await buildPlanDraftForUser(userProfile.id, input);
  const plan = await getPrisma().learningPlan.create({
    data: {
      userProfileId: userProfile.id,
      title: draft.title,
      goal: draft.goal,
      status: draft.status,
      startDate: draft.startDate,
      endDate: draft.endDate,
      steps: {
        create: draft.steps.map((step) => ({
          dayIndex: step.dayIndex,
          stepType: step.stepType,
          title: step.title,
          targetPatternId: step.targetPatternId,
          problemId: step.problemId,
          targetCount: step.targetCount,
          status: step.status,
          dueDate: step.dueDate,
        })),
      },
    },
    select: { id: true },
  });

  return { status: "created", planId: plan.id };
}

export async function getCurrentUserLearningPlans(): Promise<
  LearningPlanListItem[] | null
> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const plans = await getPrisma().learningPlan.findMany({
    where: { userProfileId: userProfile.id },
    include: {
      steps: {
        select: {
          status: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return plans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    status: plan.status,
    startDate: plan.startDate.toISOString(),
    endDate: plan.endDate?.toISOString() ?? null,
    completedSteps: plan.steps.filter((step) => step.status === "Completed")
      .length,
    totalSteps: plan.steps.length,
  }));
}

export async function getCurrentUserLearningPlan(
  planId: string,
): Promise<LearningPlanDetail | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const plan = await getPrisma().learningPlan.findFirst({
    where: {
      id: planId,
      userProfileId: userProfile.id,
    },
    include: {
      steps: {
        include: {
          targetPattern: { select: { name: true } },
          problem: { select: { title: true } },
        },
        orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!plan) {
    return null;
  }

  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    status: plan.status,
    startDate: plan.startDate.toISOString(),
    endDate: plan.endDate?.toISOString() ?? null,
    completedSteps: plan.steps.filter((step) => step.status === "Completed")
      .length,
    totalSteps: plan.steps.length,
    steps: plan.steps.map((step) => ({
      id: step.id,
      dayIndex: step.dayIndex,
      stepType: step.stepType,
      title: step.title,
      targetPatternId: step.targetPatternId,
      targetPatternName: step.targetPattern?.name ?? null,
      problemId: step.problemId,
      problemTitle: step.problem?.title ?? null,
      targetCount: step.targetCount,
      status: step.status,
      dueDate: step.dueDate.toISOString(),
      completedAt: step.completedAt?.toISOString() ?? null,
    })),
  };
}

export async function updateLearningPlanStepForCurrentUser({
  planId,
  stepId,
  status,
}: {
  planId: string;
  stepId: string;
  status: "Completed" | "Skipped";
}): Promise<StepUpdateResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated" };
  }

  const result = await getPrisma().learningPlanStep.updateMany({
    where: {
      id: stepId,
      learningPlanId: planId,
      learningPlan: {
        userProfileId: userProfile.id,
      },
    },
    data: {
      status,
      completedAt: status === "Completed" ? new Date() : null,
    },
  });

  if (result.count === 0) {
    return { status: "not_found" };
  }

  const remaining = await getPrisma().learningPlanStep.count({
    where: {
      learningPlanId: planId,
      learningPlan: {
        userProfileId: userProfile.id,
      },
      status: { in: ["Pending", "Active"] },
    },
  });

  if (remaining === 0) {
    await getPrisma().learningPlan.updateMany({
      where: {
        id: planId,
        userProfileId: userProfile.id,
      },
      data: { status: "Completed" },
    });
  }

  return { status: "updated" };
}
