import type {
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";

export type PatternMetric = {
  patternId: string;
  patternName: string;
  attemptsCount: number;
  solvedCount: number;
  partiallySolvedCount: number;
  notSolvedCount: number;
  solveRate: number;
  recognitionAttempts: number;
  recognitionCorrect: number;
  recognitionAccuracy: number;
  averageConfidence: number | null;
  averageAIScore: number | null;
  mistakeCount: number;
  flashcardCount: number;
  reviewCount: number;
  reviewRatingAverage: number | null;
  lapseCount: number;
  retentionScore: number | null;
  battleCount: number;
  battleVictoryCount: number;
  lastPracticedAt: string | null;
  daysSincePractice: number | null;
  masteryScore: number;
};

export type PatternSummary = {
  patternId: string;
  patternName: string;
  masteryScore: number;
};

export type PatternConfusionMetric = {
  selectedPatternId: string;
  correctPatternId: string;
  count: number;
  lastSeenAt: string;
  selectedPatternName: string;
  correctPatternName: string;
};

export type UserLearningMetrics = {
  totalAttempts: number;
  totalSolved: number;
  overallRecognitionAccuracy: number;
  overallRetentionScore: number | null;
  totalReviews: number;
  totalMistakes: number;
  totalFlashcards: number;
  battleWinRate: number;
  currentStreak: number;
  totalXP: number;
  strongestPattern: PatternSummary | null;
  weakestPattern: PatternSummary | null;
  mostConfusedPatternPair: PatternConfusionMetric | null;
};

export type InterviewReadinessLabel =
  | "Just Starting"
  | "Building Foundation"
  | "Pattern-Aware"
  | "Battle-Tested"
  | "Interview-Ready";

export type ReadinessMetrics = {
  overallReadinessScore: number;
  interviewReadinessLabel: InterviewReadinessLabel;
  patternsReady: PatternSummary[];
  patternsAtRisk: PatternSummary[];
  recommendedFocusPattern: PatternSummary | null;
};

export type ReadinessScoreBreakdown = {
  patternCoverage: number;
  patternRecognition: number;
  solveConsistency: number;
  retention: number;
  bossBattlePerformance: number;
  interviewPerformance: number;
  mistakeRecovery: number;
  confidence: number;
};

export type InterviewScoreTrendPoint = {
  id: string;
  title: string;
  date: string | null;
  score: number;
};

export type InterviewRubricBreakdownItem = {
  category: RubricCategory;
  averageScore: number | null;
  count: number;
};

export type InterviewWeakCategory = {
  category: RubricCategory;
  averageScore: number;
};

export type InterviewMissedSignal = {
  signal: string;
  count: number;
};

export type InterviewMissedPattern = {
  patternId: string;
  patternName: string;
  count: number;
};

export type RecommendedNextMock = {
  interviewType: InterviewType;
  title: string;
  reason: string;
  href: string;
};

export type InterviewReadinessPerformance = {
  completedCount: number;
  averageOverallScore: number | null;
  bestResult: InterviewResult | null;
  latestResult: InterviewResult | null;
  scoreTrend: InterviewScoreTrendPoint[];
  rubricBreakdown: InterviewRubricBreakdownItem[];
  lowestScoringCategories: InterviewWeakCategory[];
  commonMissedSignals: InterviewMissedSignal[];
  missedPatterns: InterviewMissedPattern[];
  recommendedNextMock: RecommendedNextMock;
};

export type ReadinessPatternSectionItem = PatternMetric & {
  reason: string;
};

export type ReadinessNextSevenDay = {
  dayIndex: number;
  title: string;
  description: string;
  href: string;
};

export type ReadinessReport = {
  overallReadinessScore: number;
  interviewReadinessLabel: InterviewReadinessLabel;
  scoreBreakdown: ReadinessScoreBreakdown;
  totalPatterns: number;
  activePatternCount: number;
  totalAttempts: number;
  strongestPatterns: ReadinessPatternSectionItem[];
  weakestPatterns: ReadinessPatternSectionItem[];
  confusingPatternPairs: PatternConfusionMetric[];
  patternsReadyForBoss: ReadinessPatternSectionItem[];
  patternsNeedingReview: ReadinessPatternSectionItem[];
  recommendedNextSevenDays: ReadinessNextSevenDay[];
  interviewPerformance: InterviewReadinessPerformance;
};
