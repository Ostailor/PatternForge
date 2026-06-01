export type Difficulty = "Easy" | "Medium" | "Hard";

export type SolvedStatus = "Solved" | "Partially Solved" | "Not Solved";

export type Confidence = 1 | 2 | 3 | 4 | 5;

export type MasteryLevel =
  | "Not Started"
  | "Warming Up"
  | "Apprentice"
  | "Forging"
  | "Sharp"
  | "Mastered";

export type Pattern = {
  id: string;
  name: string;
  category: string;
  description: string;
  recognitionClues: string[];
  templateSummary: string;
  commonMistakes: string[];
  levelOrder: number;
};

export type Problem = {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  primaryPatternId: string;
  secondaryPatternIds: string[];
  recognitionClues: string[];
  estimatedMinutes: number;
  commonMistakes: string[];
};

export type Attempt = {
  id: string;
  problemId: string;
  selectedPatternId: string;
  correctPatternId: string;
  wasPatternCorrect: boolean;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  createdAt: string;
};

export type PatternProgress = {
  patternId: string;
  recognitionCorrect: number;
  recognitionAttempts: number;
  solvedCount: number;
  attemptedCount: number;
  masteryScore: number;
  lastPracticedAt?: string;
};

export type ForgeSessionSummary = {
  id: string;
  completedAt: string;
  attempted: number;
  solved: number;
  averageConfidence: number;
};

export type UserProgress = {
  attempts: Record<string, Attempt>;
  attemptLog?: Attempt[];
  completedSessions: ForgeSessionSummary[];
  streak: number;
  lastPracticedAt?: string;
};

export type PatternStats = {
  attempted: number;
  solved: number;
  recognized: number;
};
