-- CreateEnum
CREATE TYPE "VoiceSessionStatus" AS ENUM ('Active', 'Completed', 'Abandoned');

-- CreateEnum
CREATE TYPE "VoiceSpeaker" AS ENUM ('User', 'Interviewer', 'System');

-- CreateEnum
CREATE TYPE "CommunicationInsightType" AS ENUM ('UnclearApproach', 'MissingInvariant', 'TooVerbose', 'TooQuietOrUncertain', 'StrongExplanation', 'WeakTestingExplanation', 'WeakComplexityExplanation', 'GoodTradeoffDiscussion');

-- CreateTable
CREATE TABLE "VoiceSession" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "status" "VoiceSessionStatus" NOT NULL DEFAULT 'Active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VoiceSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceTurn" (
    "id" TEXT NOT NULL,
    "voiceSessionId" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "interviewRoundId" TEXT,
    "phase" "InterviewPhase" NOT NULL,
    "speaker" "VoiceSpeaker" NOT NULL,
    "transcript" TEXT NOT NULL,
    "audioUrl" TEXT,
    "durationMs" INTEGER,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VoiceFeedback" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "voiceSessionId" TEXT NOT NULL,
    "clarityScore" INTEGER NOT NULL,
    "structureScore" INTEGER NOT NULL,
    "concisenessScore" INTEGER NOT NULL,
    "confidenceScore" INTEGER NOT NULL,
    "technicalExplanationScore" INTEGER NOT NULL,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suggestedPractice" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoiceFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationInsight" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "interviewSessionId" TEXT,
    "voiceFeedbackId" TEXT,
    "insightType" "CommunicationInsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VoiceSession_userProfileId_idx" ON "VoiceSession"("userProfileId");

-- CreateIndex
CREATE INDEX "VoiceSession_interviewSessionId_idx" ON "VoiceSession"("interviewSessionId");

-- CreateIndex
CREATE INDEX "VoiceSession_status_idx" ON "VoiceSession"("status");

-- CreateIndex
CREATE INDEX "VoiceSession_createdAt_idx" ON "VoiceSession"("createdAt");

-- CreateIndex
CREATE INDEX "VoiceTurn_voiceSessionId_idx" ON "VoiceTurn"("voiceSessionId");

-- CreateIndex
CREATE INDEX "VoiceTurn_interviewSessionId_idx" ON "VoiceTurn"("interviewSessionId");

-- CreateIndex
CREATE INDEX "VoiceTurn_interviewRoundId_idx" ON "VoiceTurn"("interviewRoundId");

-- CreateIndex
CREATE INDEX "VoiceTurn_phase_idx" ON "VoiceTurn"("phase");

-- CreateIndex
CREATE INDEX "VoiceTurn_speaker_idx" ON "VoiceTurn"("speaker");

-- CreateIndex
CREATE INDEX "VoiceTurn_createdAt_idx" ON "VoiceTurn"("createdAt");

-- CreateIndex
CREATE INDEX "VoiceFeedback_userProfileId_idx" ON "VoiceFeedback"("userProfileId");

-- CreateIndex
CREATE INDEX "VoiceFeedback_interviewSessionId_idx" ON "VoiceFeedback"("interviewSessionId");

-- CreateIndex
CREATE INDEX "VoiceFeedback_voiceSessionId_idx" ON "VoiceFeedback"("voiceSessionId");

-- CreateIndex
CREATE INDEX "VoiceFeedback_createdAt_idx" ON "VoiceFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "CommunicationInsight_userProfileId_idx" ON "CommunicationInsight"("userProfileId");

-- CreateIndex
CREATE INDEX "CommunicationInsight_interviewSessionId_idx" ON "CommunicationInsight"("interviewSessionId");

-- CreateIndex
CREATE INDEX "CommunicationInsight_voiceFeedbackId_idx" ON "CommunicationInsight"("voiceFeedbackId");

-- CreateIndex
CREATE INDEX "CommunicationInsight_insightType_idx" ON "CommunicationInsight"("insightType");

-- CreateIndex
CREATE INDEX "CommunicationInsight_severity_idx" ON "CommunicationInsight"("severity");

-- CreateIndex
CREATE INDEX "CommunicationInsight_createdAt_idx" ON "CommunicationInsight"("createdAt");

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceSession" ADD CONSTRAINT "VoiceSession_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceTurn" ADD CONSTRAINT "VoiceTurn_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceTurn" ADD CONSTRAINT "VoiceTurn_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceTurn" ADD CONSTRAINT "VoiceTurn_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFeedback" ADD CONSTRAINT "VoiceFeedback_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFeedback" ADD CONSTRAINT "VoiceFeedback_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VoiceFeedback" ADD CONSTRAINT "VoiceFeedback_voiceSessionId_fkey" FOREIGN KEY ("voiceSessionId") REFERENCES "VoiceSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationInsight" ADD CONSTRAINT "CommunicationInsight_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationInsight" ADD CONSTRAINT "CommunicationInsight_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationInsight" ADD CONSTRAINT "CommunicationInsight_voiceFeedbackId_fkey" FOREIGN KEY ("voiceFeedbackId") REFERENCES "VoiceFeedback"("id") ON DELETE SET NULL ON UPDATE CASCADE;
