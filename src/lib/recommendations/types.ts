export type WeaknessSeverity = "Unstarted" | "Low" | "Medium" | "High";

export type RecommendedActionType =
  | "FocusPattern"
  | "ContrastDrill"
  | "ReviewGauntlet"
  | "RetryProblem"
  | "BossBattle";

export type RecommendationType =
  | "DueReview"
  | "FocusPattern"
  | "ContrastDrill"
  | "RetryProblem"
  | "BossBattle"
  | "ReviewGauntlet"
  | "AIReviewFollowUp"
  | "LearningPlanStep"
  | "MockInterview"
  | "FocusedInterview"
  | "WeaknessRepairInterview"
  | "DailyForge"
  | "DebugDrill"
  | "TestingPractice"
  | "ImplementationPractice"
  | "VoiceInterview"
  | "SpeakingDrill"
  | "ExplainPattern"
  | "ComplexityNarration"
  | "TestingNarration";

export type RecommendationBattleType =
  | "PatternBoss"
  | "MixedBattle"
  | "ReviewGauntlet";

export type RecommendationCandidate = {
  title: string;
  reason: string;
  priority: number;
  recommendationType: RecommendationType;
  targetPatternId?: string;
  secondaryPatternId?: string;
  problemId?: string;
  battleType?: RecommendationBattleType;
  metadata: Record<string, unknown>;
  evidence: string[];
};

export type WeaknessPatternInput = {
  patternId: string;
  masteryScore: number;
  recognitionAccuracy: number;
  solveRate: number;
  retentionScore: number | null;
  mistakeCount: number;
  lapseCount: number;
  battleCount: number;
  battleVictoryCount: number;
  battlePartialVictoryCount?: number;
  battleDefeatCount?: number;
  daysSincePractice: number | null;
  attemptsCount: number;
  selectedIncorrectlyForOtherCount?: number;
};

export type PatternWeaknessScore = {
  patternId: string;
  weaknessScore: number;
  severity: WeaknessSeverity;
  primaryReason: string;
  evidence: string[];
  recommendedActionType: RecommendedActionType;
};
