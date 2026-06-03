import type { InterviewPhase } from "@/generated/prisma/enums";
import type { Difficulty } from "@/lib/types";

export type SpeakingDrillType =
  | "pattern"
  | "approach"
  | "debugging"
  | "complexity";

export type SpeakingDrillPrompt = {
  id: string;
  drillType: SpeakingDrillType;
  phase: InterviewPhase;
  title: string;
  eyebrow: string;
  description: string;
  contextTitle: string;
  contextItems: Array<{
    label: string;
    value: string;
  }>;
  focusChecklist: string[];
  patternId?: string;
  problemId?: string;
  attemptId?: string;
  codeRunId?: string;
  interviewRoundId?: string;
  difficulty?: Difficulty;
  isAvailable: boolean;
  unavailableReason?: string;
};

export type SpeakingScoreResult = {
  clarityScore: number;
  structureScore: number;
  concisenessScore: number;
  confidenceScore: number;
  technicalExplanationScore: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  suggestedPractice: string[];
  insights: Array<{
    insightType: string;
    severity: string;
    summary: string;
  }>;
};

export type SpeakingStudyCardActionResult = {
  status: "created" | "invalid" | "unauthenticated";
  message: string;
};
