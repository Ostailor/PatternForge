import type {
  PatternConfusionMetric,
  PatternMetric,
  UserLearningMetrics,
} from "@/lib/analytics/types";

export type LearningPlanType =
  | "InterviewPrepSprint"
  | "MasterPattern"
  | "WeaknessRepair"
  | "MaintenanceMode";

export type LearningPlanStepType =
  | "Review"
  | "FocusProblem"
  | "MixedProblem"
  | "ContrastDrill"
  | "BossBattle"
  | "Reflection";

export type LearningPlanStepDraft = {
  dayIndex: number;
  stepType: LearningPlanStepType;
  title: string;
  targetPatternId?: string;
  problemId?: string;
  targetCount?: number;
  dueDate: Date;
  status: "Pending" | "Active";
};

export type LearningPlanDraft = {
  title: string;
  goal: string;
  status: "Active";
  startDate: Date;
  endDate?: Date;
  steps: LearningPlanStepDraft[];
};

export type LearningPlanGenerationInput = {
  planType: LearningPlanType;
  startDate: Date;
  targetPatternId?: string;
  patternMetrics: PatternMetric[];
  confusions: PatternConfusionMetric[];
  userMetrics: UserLearningMetrics;
};
