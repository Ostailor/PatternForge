-- CreateEnum
CREATE TYPE "InterviewType" AS ENUM ('SingleProblem', 'FocusedPattern', 'MixedInterview', 'WeaknessRepair');

-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('Active', 'Completed', 'Abandoned');

-- CreateEnum
CREATE TYPE "InterviewRoundStatus" AS ENUM ('Pending', 'Active', 'Completed', 'Skipped');

-- CreateEnum
CREATE TYPE "InterviewResult" AS ENUM ('StrongHire', 'Hire', 'LeanHire', 'LeanNoHire', 'NoHire');

-- CreateEnum
CREATE TYPE "InterviewMessageRole" AS ENUM ('User', 'Interviewer', 'System');

-- CreateEnum
CREATE TYPE "InterviewPhase" AS ENUM ('Setup', 'ClarifyingQuestions', 'PatternHypothesis', 'Approach', 'Implementation', 'Testing', 'Complexity', 'Feedback');

-- CreateEnum
CREATE TYPE "RubricCategory" AS ENUM ('Communication', 'PatternRecognition', 'ProblemSolving', 'Implementation', 'Testing', 'Complexity', 'TimeManagement');

-- CreateTable
CREATE TABLE "InterviewSession" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "interviewType" "InterviewType" NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'Active',
    "title" TEXT NOT NULL,
    "targetPatternId" TEXT,
    "difficultyTarget" "Difficulty",
    "durationMinutes" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "overallScore" INTEGER,
    "communicationScore" INTEGER,
    "patternRecognitionScore" INTEGER,
    "problemSolvingScore" INTEGER,
    "implementationScore" INTEGER,
    "testingScore" INTEGER,
    "complexityScore" INTEGER,
    "timeManagementScore" INTEGER,
    "result" "InterviewResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "status" "InterviewRoundStatus" NOT NULL DEFAULT 'Pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "selectedPatternId" TEXT,
    "correctPatternId" TEXT NOT NULL,
    "patternExplanation" TEXT,
    "approachText" TEXT,
    "codeText" TEXT,
    "testCasesText" TEXT,
    "complexityText" TEXT,
    "attemptId" TEXT,
    "aiReviewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewMessage" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "interviewRoundId" TEXT,
    "role" "InterviewMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "phase" "InterviewPhase" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewFeedback" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "interviewRoundId" TEXT,
    "summary" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rubric" JSONB NOT NULL DEFAULT '{}',
    "followUpRecommendations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRubricScore" (
    "id" TEXT NOT NULL,
    "interviewSessionId" TEXT NOT NULL,
    "category" "RubricCategory" NOT NULL,
    "score" INTEGER NOT NULL,
    "notes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRubricScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewSession_userProfileId_idx" ON "InterviewSession"("userProfileId");

-- CreateIndex
CREATE INDEX "InterviewSession_targetPatternId_idx" ON "InterviewSession"("targetPatternId");

-- CreateIndex
CREATE INDEX "InterviewSession_status_idx" ON "InterviewSession"("status");

-- CreateIndex
CREATE INDEX "InterviewSession_startedAt_idx" ON "InterviewSession"("startedAt");

-- CreateIndex
CREATE INDEX "InterviewSession_completedAt_idx" ON "InterviewSession"("completedAt");

-- CreateIndex
CREATE INDEX "InterviewSession_createdAt_idx" ON "InterviewSession"("createdAt");

-- CreateIndex
CREATE INDEX "InterviewRound_interviewSessionId_idx" ON "InterviewRound"("interviewSessionId");

-- CreateIndex
CREATE INDEX "InterviewRound_problemId_idx" ON "InterviewRound"("problemId");

-- CreateIndex
CREATE INDEX "InterviewRound_status_idx" ON "InterviewRound"("status");

-- CreateIndex
CREATE INDEX "InterviewRound_startedAt_idx" ON "InterviewRound"("startedAt");

-- CreateIndex
CREATE INDEX "InterviewRound_completedAt_idx" ON "InterviewRound"("completedAt");

-- CreateIndex
CREATE INDEX "InterviewRound_createdAt_idx" ON "InterviewRound"("createdAt");

-- CreateIndex
CREATE INDEX "InterviewRound_selectedPatternId_idx" ON "InterviewRound"("selectedPatternId");

-- CreateIndex
CREATE INDEX "InterviewRound_correctPatternId_idx" ON "InterviewRound"("correctPatternId");

-- CreateIndex
CREATE INDEX "InterviewRound_attemptId_idx" ON "InterviewRound"("attemptId");

-- CreateIndex
CREATE INDEX "InterviewRound_aiReviewId_idx" ON "InterviewRound"("aiReviewId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRound_interviewSessionId_roundNumber_key" ON "InterviewRound"("interviewSessionId", "roundNumber");

-- CreateIndex
CREATE INDEX "InterviewMessage_interviewSessionId_idx" ON "InterviewMessage"("interviewSessionId");

-- CreateIndex
CREATE INDEX "InterviewMessage_interviewRoundId_idx" ON "InterviewMessage"("interviewRoundId");

-- CreateIndex
CREATE INDEX "InterviewMessage_phase_idx" ON "InterviewMessage"("phase");

-- CreateIndex
CREATE INDEX "InterviewMessage_createdAt_idx" ON "InterviewMessage"("createdAt");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewSessionId_idx" ON "InterviewFeedback"("interviewSessionId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_interviewRoundId_idx" ON "InterviewFeedback"("interviewRoundId");

-- CreateIndex
CREATE INDEX "InterviewFeedback_createdAt_idx" ON "InterviewFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "InterviewRubricScore_interviewSessionId_idx" ON "InterviewRubricScore"("interviewSessionId");

-- CreateIndex
CREATE INDEX "InterviewRubricScore_category_idx" ON "InterviewRubricScore"("category");

-- CreateIndex
CREATE INDEX "InterviewRubricScore_createdAt_idx" ON "InterviewRubricScore"("createdAt");

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewSession" ADD CONSTRAINT "InterviewSession_targetPatternId_fkey" FOREIGN KEY ("targetPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_selectedPatternId_fkey" FOREIGN KEY ("selectedPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_correctPatternId_fkey" FOREIGN KEY ("correctPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_aiReviewId_fkey" FOREIGN KEY ("aiReviewId") REFERENCES "AIReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewMessage" ADD CONSTRAINT "InterviewMessage_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewFeedback" ADD CONSTRAINT "InterviewFeedback_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRubricScore" ADD CONSTRAINT "InterviewRubricScore_interviewSessionId_fkey" FOREIGN KEY ("interviewSessionId") REFERENCES "InterviewSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
