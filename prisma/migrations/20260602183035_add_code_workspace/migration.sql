-- CreateEnum
CREATE TYPE "CodeLanguage" AS ENUM ('Python');

-- CreateEnum
CREATE TYPE "CodeSubmissionStatus" AS ENUM ('Draft', 'Submitted', 'Reviewed');

-- CreateEnum
CREATE TYPE "CodeRunType" AS ENUM ('CustomTests', 'SmokeTest', 'FreeRun');

-- CreateEnum
CREATE TYPE "CodeRunStatus" AS ENUM ('Queued', 'Running', 'Succeeded', 'Failed', 'TimedOut', 'RuntimeError', 'ValidationError');

-- CreateEnum
CREATE TYPE "TestCaseSource" AS ENUM ('User', 'PatternForge');

-- CreateTable
CREATE TABLE "ProblemRunnerConfig" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "language" "CodeLanguage" NOT NULL,
    "functionName" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL,
    "outputSchema" JSONB NOT NULL,
    "harnessTemplate" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemRunnerConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSubmission" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "attemptId" TEXT,
    "interviewRoundId" TEXT,
    "battleRoundId" TEXT,
    "language" "CodeLanguage" NOT NULL,
    "code" TEXT NOT NULL,
    "status" "CodeSubmissionStatus" NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeRun" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "codeSubmissionId" TEXT NOT NULL,
    "runType" "CodeRunType" NOT NULL,
    "status" "CodeRunStatus" NOT NULL DEFAULT 'Queued',
    "stdout" TEXT NOT NULL DEFAULT '',
    "stderr" TEXT NOT NULL DEFAULT '',
    "compileOutput" TEXT,
    "errorMessage" TEXT,
    "runtimeMs" INTEGER,
    "memoryKb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CodeRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT,
    "problemId" TEXT NOT NULL,
    "source" "TestCaseSource" NOT NULL,
    "name" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "expectedOutputJson" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestResult" (
    "id" TEXT NOT NULL,
    "codeRunId" TEXT NOT NULL,
    "testCaseId" TEXT,
    "name" TEXT NOT NULL,
    "inputJson" JSONB NOT NULL,
    "expectedOutputJson" JSONB NOT NULL,
    "actualOutputJson" JSONB,
    "passed" BOOLEAN NOT NULL,
    "stdout" TEXT,
    "stderr" TEXT,
    "errorMessage" TEXT,
    "runtimeMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebugInsight" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "codeRunId" TEXT NOT NULL,
    "attemptId" TEXT,
    "interviewRoundId" TEXT,
    "summary" TEXT NOT NULL,
    "likelyCause" TEXT NOT NULL,
    "suggestedFix" TEXT NOT NULL,
    "followUpQuestion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DebugInsight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProblemRunnerConfig_problemId_idx" ON "ProblemRunnerConfig"("problemId");

-- CreateIndex
CREATE INDEX "ProblemRunnerConfig_language_idx" ON "ProblemRunnerConfig"("language");

-- CreateIndex
CREATE INDEX "ProblemRunnerConfig_createdAt_idx" ON "ProblemRunnerConfig"("createdAt");

-- CreateIndex
CREATE INDEX "CodeSubmission_userProfileId_idx" ON "CodeSubmission"("userProfileId");

-- CreateIndex
CREATE INDEX "CodeSubmission_problemId_idx" ON "CodeSubmission"("problemId");

-- CreateIndex
CREATE INDEX "CodeSubmission_attemptId_idx" ON "CodeSubmission"("attemptId");

-- CreateIndex
CREATE INDEX "CodeSubmission_interviewRoundId_idx" ON "CodeSubmission"("interviewRoundId");

-- CreateIndex
CREATE INDEX "CodeSubmission_battleRoundId_idx" ON "CodeSubmission"("battleRoundId");

-- CreateIndex
CREATE INDEX "CodeSubmission_status_idx" ON "CodeSubmission"("status");

-- CreateIndex
CREATE INDEX "CodeSubmission_language_idx" ON "CodeSubmission"("language");

-- CreateIndex
CREATE INDEX "CodeSubmission_createdAt_idx" ON "CodeSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "CodeRun_userProfileId_idx" ON "CodeRun"("userProfileId");

-- CreateIndex
CREATE INDEX "CodeRun_codeSubmissionId_idx" ON "CodeRun"("codeSubmissionId");

-- CreateIndex
CREATE INDEX "CodeRun_status_idx" ON "CodeRun"("status");

-- CreateIndex
CREATE INDEX "CodeRun_createdAt_idx" ON "CodeRun"("createdAt");

-- CreateIndex
CREATE INDEX "TestCase_userProfileId_idx" ON "TestCase"("userProfileId");

-- CreateIndex
CREATE INDEX "TestCase_problemId_idx" ON "TestCase"("problemId");

-- CreateIndex
CREATE INDEX "TestCase_source_idx" ON "TestCase"("source");

-- CreateIndex
CREATE INDEX "TestCase_createdAt_idx" ON "TestCase"("createdAt");

-- CreateIndex
CREATE INDEX "TestResult_codeRunId_idx" ON "TestResult"("codeRunId");

-- CreateIndex
CREATE INDEX "TestResult_testCaseId_idx" ON "TestResult"("testCaseId");

-- CreateIndex
CREATE INDEX "TestResult_createdAt_idx" ON "TestResult"("createdAt");

-- CreateIndex
CREATE INDEX "DebugInsight_userProfileId_idx" ON "DebugInsight"("userProfileId");

-- CreateIndex
CREATE INDEX "DebugInsight_codeRunId_idx" ON "DebugInsight"("codeRunId");

-- CreateIndex
CREATE INDEX "DebugInsight_attemptId_idx" ON "DebugInsight"("attemptId");

-- CreateIndex
CREATE INDEX "DebugInsight_interviewRoundId_idx" ON "DebugInsight"("interviewRoundId");

-- CreateIndex
CREATE INDEX "DebugInsight_createdAt_idx" ON "DebugInsight"("createdAt");

-- AddForeignKey
ALTER TABLE "ProblemRunnerConfig" ADD CONSTRAINT "ProblemRunnerConfig_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_battleRoundId_fkey" FOREIGN KEY ("battleRoundId") REFERENCES "BattleRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRun" ADD CONSTRAINT "CodeRun_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeRun" ADD CONSTRAINT "CodeRun_codeSubmissionId_fkey" FOREIGN KEY ("codeSubmissionId") REFERENCES "CodeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_codeRunId_fkey" FOREIGN KEY ("codeRunId") REFERENCES "CodeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestResult" ADD CONSTRAINT "TestResult_testCaseId_fkey" FOREIGN KEY ("testCaseId") REFERENCES "TestCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugInsight" ADD CONSTRAINT "DebugInsight_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugInsight" ADD CONSTRAINT "DebugInsight_codeRunId_fkey" FOREIGN KEY ("codeRunId") REFERENCES "CodeRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugInsight" ADD CONSTRAINT "DebugInsight_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebugInsight" ADD CONSTRAINT "DebugInsight_interviewRoundId_fkey" FOREIGN KEY ("interviewRoundId") REFERENCES "InterviewRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;
