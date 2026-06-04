-- Add composite indexes for v0.9 beta performance paths.
-- These are additive only and preserve existing v0.8/v0.9 data.

CREATE INDEX "AnalyticsEvent_userProfileId_createdAt_idx" ON "AnalyticsEvent"("userProfileId", "createdAt");

CREATE INDEX "UserFeedback_userProfileId_createdAt_idx" ON "UserFeedback"("userProfileId", "createdAt");
CREATE INDEX "UserFeedback_status_createdAt_idx" ON "UserFeedback"("status", "createdAt");

CREATE INDEX "Mistake_userProfileId_status_reviewDueAt_idx" ON "Mistake"("userProfileId", "status", "reviewDueAt");

CREATE INDEX "Flashcard_userProfileId_status_reviewDueAt_idx" ON "Flashcard"("userProfileId", "status", "reviewDueAt");

CREATE INDEX "ReviewLog_userProfileId_reviewedAt_idx" ON "ReviewLog"("userProfileId", "reviewedAt");

CREATE INDEX "GameEvent_userProfileId_createdAt_idx" ON "GameEvent"("userProfileId", "createdAt");

CREATE INDEX "Recommendation_userProfileId_status_priority_createdAt_idx" ON "Recommendation"("userProfileId", "status", "priority", "createdAt");

CREATE INDEX "LearningPlan_userProfileId_status_createdAt_idx" ON "LearningPlan"("userProfileId", "status", "createdAt");

CREATE INDEX "InterviewSession_userProfileId_status_completedAt_idx" ON "InterviewSession"("userProfileId", "status", "completedAt");
CREATE INDEX "InterviewSession_userProfileId_createdAt_idx" ON "InterviewSession"("userProfileId", "createdAt");

CREATE INDEX "CodeSubmission_userProfileId_updatedAt_idx" ON "CodeSubmission"("userProfileId", "updatedAt");
CREATE INDEX "CodeSubmission_userProfileId_status_updatedAt_idx" ON "CodeSubmission"("userProfileId", "status", "updatedAt");
CREATE INDEX "CodeSubmission_userProfileId_problemId_updatedAt_idx" ON "CodeSubmission"("userProfileId", "problemId", "updatedAt");
CREATE INDEX "CodeSubmission_userProfileId_language_updatedAt_idx" ON "CodeSubmission"("userProfileId", "language", "updatedAt");

CREATE INDEX "CodeRun_userProfileId_createdAt_idx" ON "CodeRun"("userProfileId", "createdAt");
CREATE INDEX "CodeRun_userProfileId_status_createdAt_idx" ON "CodeRun"("userProfileId", "status", "createdAt");

CREATE INDEX "VoiceSession_userProfileId_status_createdAt_idx" ON "VoiceSession"("userProfileId", "status", "createdAt");

CREATE INDEX "VoiceTurn_voiceSessionId_speaker_createdAt_idx" ON "VoiceTurn"("voiceSessionId", "speaker", "createdAt");
CREATE INDEX "VoiceTurn_interviewSessionId_speaker_createdAt_idx" ON "VoiceTurn"("interviewSessionId", "speaker", "createdAt");
