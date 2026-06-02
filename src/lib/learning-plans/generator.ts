import { getPatternById } from "@/data/patterns";
import { problems } from "@/data/problems";
import type { PatternConfusionMetric, PatternMetric } from "@/lib/analytics/types";

import type {
  LearningPlanDraft,
  LearningPlanGenerationInput,
  LearningPlanStepDraft,
  LearningPlanStepType,
  LearningPlanType,
} from "./types";

const BEGINNER_PATTERN_IDS = ["arrays-hashing", "two-pointers"];
const INTERVIEW_PATTERN_IDS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
  "linked-list",
  "tree-dfs",
  "tree-bfs",
  "heap-priority-queue",
  "backtracking",
  "graph-bfs-dfs",
  "dynamic-programming-1d",
];

const planLengths: Record<LearningPlanType, number> = {
  InterviewPrepSprint: 14,
  MasterPattern: 7,
  WeaknessRepair: 10,
  MaintenanceMode: 7,
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getPatternName(patternId: string | undefined): string {
  return getPatternById(patternId ?? "")?.name ?? "Core Patterns";
}

function getProblemForPattern(patternId: string, usedProblemIds: Set<string>) {
  const pool = problems
    .filter((problem) => problem.primaryPatternId === patternId)
    .sort(
      (a, b) =>
        a.estimatedMinutes - b.estimatedMinutes ||
        a.difficulty.localeCompare(b.difficulty) ||
        a.title.localeCompare(b.title),
    );

  return (
    pool.find((problem) => !usedProblemIds.has(problem.id)) ??
    pool[0] ??
    problems.find((problem) => !usedProblemIds.has(problem.id)) ??
    problems[0]
  );
}

function getMixedProblem(
  excludedPatternId: string | undefined,
  usedProblemIds: Set<string>,
) {
  const pool = problems
    .filter((problem) => problem.primaryPatternId !== excludedPatternId)
    .sort(
      (a, b) =>
        a.estimatedMinutes - b.estimatedMinutes ||
        a.difficulty.localeCompare(b.difficulty) ||
        a.title.localeCompare(b.title),
    );

  return (
    pool.find((problem) => !usedProblemIds.has(problem.id)) ??
    pool[0] ??
    problems[0]
  );
}

function getWeakPatternIds(patternMetrics: PatternMetric[]): string[] {
  const signaledMetrics = patternMetrics.filter(
    (metric) => metric.attemptsCount > 0 || metric.reviewCount > 0,
  );

  if (signaledMetrics.length === 0) {
    return [...BEGINNER_PATTERN_IDS];
  }

  return signaledMetrics
    .slice()
    .sort(
      (a, b) =>
        a.masteryScore - b.masteryScore ||
        (a.retentionScore ?? 100) - (b.retentionScore ?? 100) ||
        a.patternName.localeCompare(b.patternName),
    )
    .map((metric) => metric.patternId);
}

function getReadyPatternIds(patternMetrics: PatternMetric[]): string[] {
  return patternMetrics
    .filter(
      (metric) =>
        metric.attemptsCount > 0 &&
        metric.masteryScore >= 76 &&
        (metric.retentionScore ?? 0) >= 75,
    )
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        (b.retentionScore ?? 0) - (a.retentionScore ?? 0),
    )
    .map((metric) => metric.patternId);
}

function getPrimaryConfusion(
  confusions: PatternConfusionMetric[],
): PatternConfusionMetric | null {
  return (
    confusions
      .slice()
      .sort(
        (a, b) =>
          b.count - a.count ||
          new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime(),
      )[0] ?? null
  );
}

function makeStep({
  dayIndex,
  stepType,
  title,
  targetPatternId,
  problemId,
  targetCount,
  startDate,
}: {
  dayIndex: number;
  stepType: LearningPlanStepType;
  title: string;
  targetPatternId?: string;
  problemId?: string;
  targetCount?: number;
  startDate: Date;
}): LearningPlanStepDraft {
  return {
    dayIndex,
    stepType,
    title,
    targetPatternId,
    problemId,
    targetCount,
    dueDate: addDays(startDate, dayIndex),
    status: dayIndex === 0 ? "Active" : "Pending",
  };
}

function planTitle(planType: LearningPlanType, targetPatternId?: string): string {
  switch (planType) {
    case "InterviewPrepSprint":
      return "14-Day Interview Prep Sprint";
    case "MasterPattern":
      return `Master ${getPatternName(targetPatternId)}`;
    case "WeaknessRepair":
      return "Weakness Repair Plan";
    case "MaintenanceMode":
      return "Maintenance Mode Plan";
  }
}

function planGoal(input: LearningPlanGenerationInput): string {
  const retentionClause =
    input.userMetrics.overallRetentionScore !== null &&
    input.userMetrics.overallRetentionScore < 60
      ? " Extra review days are included because retention is currently weak."
      : "";

  switch (input.planType) {
    case "InterviewPrepSprint":
      return `Build broad interview readiness with daily review, focused pattern reps, mixed practice, and pressure checks.${retentionClause}`;
    case "MasterPattern":
      return `Focus repeated practice on ${getPatternName(input.targetPatternId)} until recognition and implementation feel automatic.${retentionClause}`;
    case "WeaknessRepair":
      return `Repair weak patterns and pattern confusions with targeted drills, review, and focused implementation.${retentionClause}`;
    case "MaintenanceMode":
      return `Keep retention strong with reviews, mixed practice, and light reflection.${retentionClause}`;
  }
}

function choosePatternForDay(patternIds: string[], dayIndex: number): string {
  return patternIds[dayIndex % patternIds.length] ?? BEGINNER_PATTERN_IDS[0];
}

function buildPlanSteps(input: LearningPlanGenerationInput): LearningPlanStepDraft[] {
  const length = planLengths[input.planType];
  const usedProblemIds = new Set<string>();
  const weakPatternIds = getWeakPatternIds(input.patternMetrics);
  const readyPatternIds = getReadyPatternIds(input.patternMetrics);
  const confusion = getPrimaryConfusion(input.confusions);
  const weakRetention =
    input.userMetrics.overallRetentionScore !== null &&
    input.userMetrics.overallRetentionScore < 60;
  const steps: LearningPlanStepDraft[] = [];

  for (let dayIndex = 0; dayIndex < length; dayIndex += 1) {
    const selectedPatternId =
      input.planType === "MasterPattern" && input.targetPatternId
        ? input.targetPatternId
        : input.planType === "InterviewPrepSprint" && input.userMetrics.totalAttempts === 0
          ? choosePatternForDay(BEGINNER_PATTERN_IDS, dayIndex)
          : choosePatternForDay(
              input.planType === "InterviewPrepSprint"
                ? INTERVIEW_PATTERN_IDS
                : weakPatternIds,
              dayIndex,
            );

    if (weakRetention && dayIndex % 3 === 0) {
      steps.push(
        makeStep({
          dayIndex,
          stepType: "Review",
          title: "Daily review repair",
          targetPatternId: selectedPatternId,
          targetCount: 5,
          startDate: input.startDate,
        }),
      );
      continue;
    }

    if (confusion && (input.planType === "WeaknessRepair" || dayIndex === 3)) {
      steps.push(
        makeStep({
          dayIndex,
          stepType: "ContrastDrill",
          title: `${confusion.selectedPatternName} vs ${confusion.correctPatternName}`,
          targetPatternId: confusion.correctPatternId,
          startDate: input.startDate,
        }),
      );
      continue;
    }

    if (readyPatternIds.length > 0 && dayIndex === length - 2) {
      const readyPatternId = choosePatternForDay(readyPatternIds, dayIndex);

      steps.push(
        makeStep({
          dayIndex,
          stepType: "BossBattle",
          title: `${getPatternName(readyPatternId)} boss battle`,
          targetPatternId: readyPatternId,
          startDate: input.startDate,
        }),
      );
      continue;
    }

    if (dayIndex === length - 1) {
      steps.push(
        makeStep({
          dayIndex,
          stepType: "Reflection",
          title: "Plan reflection and next action",
          targetCount: 1,
          startDate: input.startDate,
        }),
      );
      continue;
    }

    if (input.planType === "MaintenanceMode" && dayIndex % 2 === 0) {
      steps.push(
        makeStep({
          dayIndex,
          stepType: "Review",
          title: "Retention review block",
          targetPatternId: selectedPatternId,
          targetCount: 4,
          startDate: input.startDate,
        }),
      );
      continue;
    }

    const problem =
      input.planType === "InterviewPrepSprint" && dayIndex % 4 === 2
        ? getMixedProblem(selectedPatternId, usedProblemIds)
        : getProblemForPattern(selectedPatternId, usedProblemIds);
    usedProblemIds.add(problem.id);

    steps.push(
      makeStep({
        dayIndex,
        stepType:
          input.planType === "InterviewPrepSprint" && dayIndex % 4 === 2
            ? "MixedProblem"
            : "FocusProblem",
        title:
          input.planType === "InterviewPrepSprint" && dayIndex % 4 === 2
            ? "Mixed pattern practice"
            : `${getPatternName(selectedPatternId)} focused problem`,
        targetPatternId: selectedPatternId,
        problemId: problem.id,
        targetCount: 1,
        startDate: input.startDate,
      }),
    );
  }

  return steps;
}

export function generateLearningPlanDraft(
  input: LearningPlanGenerationInput,
): LearningPlanDraft {
  const steps = buildPlanSteps(input);

  return {
    title: planTitle(input.planType, input.targetPatternId),
    goal: planGoal(input),
    status: "Active",
    startDate: input.startDate,
    endDate: addDays(input.startDate, planLengths[input.planType] - 1),
    steps,
  };
}

export function getPlanTypeLabel(planType: LearningPlanType): string {
  switch (planType) {
    case "InterviewPrepSprint":
      return "Interview Prep Sprint";
    case "MasterPattern":
      return "Master a Pattern";
    case "WeaknessRepair":
      return "Weakness Repair";
    case "MaintenanceMode":
      return "Maintenance Mode";
  }
}
