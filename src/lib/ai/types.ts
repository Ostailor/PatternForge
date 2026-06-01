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
