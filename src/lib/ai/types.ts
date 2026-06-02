import type {
  InterviewPhase,
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
  userInput: string;
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
