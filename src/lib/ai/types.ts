import type {
  InterviewPhase,
  VoiceSpeaker,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import type { Difficulty, SolvedStatus } from "@/lib/types";

export type AIReviewInput = {
  problemTitle: string;
  difficulty: Difficulty;
  patternName: string;
  secondaryPatternNames: string[];
  recognitionClues: string[];
  commonMistakes: string[];
  userSelectedPattern: string;
  wasPatternCorrect: boolean;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: number;
  reflection: string;
  userCode: string;
  userExplanation: string;
  codeExecution: {
    runStatus: string;
    runtimeMs: number | null;
    testsPassed: number;
    testsFailed: number;
    failedTestSummaries: {
      name: string;
      inputJson: unknown;
      expectedOutputJson: unknown;
      actualOutputJson: unknown;
      errorMessage: string | null;
    }[];
    stdout: string;
    stderr: string;
    runtimeError: string | null;
  } | null;
  latestDebugInsight: {
    summary: string;
    likelyCause: string;
    suggestedFix: string;
  } | null;
};

export type SuggestedMistake = {
  mistakeType: string;
  description: string;
  correction: string;
};

export type SuggestedFlashcard = {
  front: string;
  back: string;
};

export type AIReviewOutput = {
  patternScore: number;
  implementationScore: number;
  complexityScore: number;
  explanationScore: number;
  feedbackSummary: string;
  strengths: string[];
  weaknesses: string[];
  complexityFeedback: string;
  suggestedMistakes: SuggestedMistake[];
  suggestedFlashcards: SuggestedFlashcard[];
  suggestedNextStep: string;
};

export type SavedAIReview = AIReviewOutput & {
  id: string;
  attemptId: string;
  problemId: string;
  patternId: string;
  problemTitle: string;
  patternName: string;
  createdAt: string;
};

export type AIHintInput = {
  problemTitle: string;
  difficulty: Difficulty;
  patternName: string;
  secondaryPatternNames: string[];
  recognitionClues: string[];
  commonMistakes: string[];
};

export type HintLevel = {
  level: 1 | 2 | 3 | 4 | 5;
  title: string;
  hint: string;
};

export type AIHintOutput = {
  levels: HintLevel[];
};

export type AIPromptMessage = {
  role: "system" | "user";
  content: string;
};

export type AIInterviewMessageInput = {
  role: "User" | "Interviewer" | "System";
  phase: InterviewPhase;
  content: string;
};

export type AIInterviewVoiceTurnInput = {
  phase: InterviewPhase;
  speaker: VoiceSpeaker;
  transcript: string;
  durationMs?: number | null;
  createdAt?: string | null;
};

export type AIInterviewCodeExecutionInput = {
  didRun: boolean;
  latestRunStatus: string | null;
  runtimeMs: number | null;
  totalTests: number;
  testsPassed: number;
  testsFailed: number;
  successfulRunCount: number;
  failedRunCount: number;
  userCreatedTestCount: number;
  fixedAfterFailedRun: boolean;
  stdout: string;
  stderr: string;
  runtimeError: string | null;
  failedTestSummaries: {
    name: string;
    inputJson: unknown;
    expectedOutputJson: unknown;
    actualOutputJson: unknown;
    errorMessage: string | null;
  }[];
};

export type AIInterviewPhaseData = {
  selectedPatternName?: string | null;
  patternExplanation?: string | null;
  approachText?: string | null;
  codeText?: string | null;
  testCasesText?: string | null;
  complexityText?: string | null;
};

export type AIInterviewerInput = {
  interviewType: InterviewType;
  currentPhase: InterviewPhase;
  problemTitle: string;
  difficulty: Difficulty;
  recognitionClues: string[];
  commonMistakes: string[];
  correctPattern: string;
  secondaryPatterns: string[];
  previousMessages: AIInterviewMessageInput[];
  previousVoiceTurns: AIInterviewVoiceTurnInput[];
  currentPhaseVoiceTurns: AIInterviewVoiceTurnInput[];
  userInput: string;
  userInputWasSpoken: boolean;
  codeExecution: AIInterviewCodeExecutionInput | null;
  currentPhaseData: AIInterviewPhaseData;
  canRevealCorrectPattern: boolean;
};

export type AIInterviewerOutput = {
  interviewerMessage: string;
  phaseSuggestion: InterviewPhase | null;
  hintLevel: 1 | 2 | 3 | 4 | 5 | null;
  concernFlags: string[];
};

export type AIInterviewFeedbackInput = {
  interviewType: InterviewType;
  problemTitle: string;
  difficulty: Difficulty;
  correctPattern: string;
  secondaryPatterns: string[];
  recognitionClues: string[];
  commonMistakes: string[];
  selectedPatternName: string | null;
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
  messages: AIInterviewMessageInput[];
};

export type AIInterviewFeedbackOutput = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rubric: Partial<Record<RubricCategory, number>>;
  followUpRecommendations: string[];
};
