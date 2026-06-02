import type {
  Difficulty,
  InterviewRoundStatus,
  InterviewStatus,
  InterviewType,
} from "@/generated/prisma/enums";

export type InterviewGenerationOptions = {
  difficultyTarget?: Difficulty;
  durationMinutes?: number;
  now?: Date;
  problemId?: string;
  recentAttemptDays?: number;
  title?: string;
};

export type FocusedPatternInterviewOptions = Omit<
  InterviewGenerationOptions,
  "problemId"
> & {
  roundCount?: 1 | 2;
};

export type MultiProblemInterviewOptions = Omit<
  InterviewGenerationOptions,
  "problemId"
> & {
  roundCount?: 1 | 2 | 3;
};

export type InterviewRoundConfig = {
  problemId: string;
  correctPatternId: string;
  roundNumber?: number;
};

export type InterviewSessionConfig = {
  interviewType: InterviewType;
  title: string;
  targetPatternId?: string;
  difficultyTarget?: Difficulty;
  durationMinutes: number;
  rounds: InterviewRoundConfig[];
  startedAt?: Date;
};

export type InterviewProblemMetadata = {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  recognitionClues: string[];
  commonMistakes: string[];
};

export type GeneratedInterviewRound = {
  id: string;
  interviewSessionId: string;
  problemId: string;
  roundNumber: number;
  status: InterviewRoundStatus;
  startedAt: string;
  completedAt: string | null;
  selectedPatternId: string | null;
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
  attemptId: string | null;
  aiReviewId: string | null;
  createdAt: string;
  updatedAt: string;
  problem: InterviewProblemMetadata;
};

export type GeneratedInterviewSession = {
  id: string;
  userProfileId: string;
  interviewType: InterviewType;
  status: InterviewStatus;
  title: string;
  targetPatternId: string | null;
  difficultyTarget: Difficulty | null;
  durationMinutes: number;
  startedAt: string;
  completedAt: string | null;
  overallScore: number | null;
  communicationScore: number | null;
  patternRecognitionScore: number | null;
  problemSolvingScore: number | null;
  implementationScore: number | null;
  testingScore: number | null;
  complexityScore: number | null;
  timeManagementScore: number | null;
  result: string | null;
  createdAt: string;
  updatedAt: string;
  rounds: GeneratedInterviewRound[];
};

