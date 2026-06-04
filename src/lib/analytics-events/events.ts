export const AnalyticsEvents = {
  OnboardingStarted: "onboarding_started",
  OnboardingCompleted: "onboarding_completed",
  DiagnosticStarted: "diagnostic_started",
  DiagnosticCompleted: "diagnostic_completed",
  DailyForgeStarted: "daily_forge_started",
  AttemptCompleted: "attempt_completed",
  AIReviewRequested: "ai_review_requested",
  AIReviewCompleted: "ai_review_completed",
  DailyReviewStarted: "daily_review_started",
  DailyReviewCompleted: "daily_review_completed",
  BattleStarted: "battle_started",
  BattleCompleted: "battle_completed",
  InterviewStarted: "interview_started",
  InterviewCompleted: "interview_completed",
  CodeRunStarted: "code_run_started",
  CodeRunCompleted: "code_run_completed",
  VoiceTurnSaved: "voice_turn_saved",
  RecommendationAccepted: "recommendation_accepted",
  RecommendationDismissed: "recommendation_dismissed",
  FeedbackSubmitted: "feedback_submitted",
  RateLimitHit: "rate_limit_hit",
} as const;

export const analyticsEventNames = Object.values(AnalyticsEvents);

export type AnalyticsEventName =
  (typeof AnalyticsEvents)[keyof typeof AnalyticsEvents];
