-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('Easy', 'Medium', 'Hard');

-- CreateEnum
CREATE TYPE "SolvedStatus" AS ENUM ('Solved', 'PartiallySolved', 'NotSolved');

-- CreateTable
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recognitionClues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "templateSummary" TEXT NOT NULL,
    "commonMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "levelOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Problem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "recognitionClues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commonMistakes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Problem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemPattern" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ProblemPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "selectedPatternId" TEXT NOT NULL,
    "correctPatternId" TEXT NOT NULL,
    "wasPatternCorrect" BOOLEAN NOT NULL,
    "solvedStatus" "SolvedStatus" NOT NULL,
    "timeSpentMinutes" INTEGER NOT NULL,
    "confidence" INTEGER NOT NULL,
    "reflection" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_authUserId_key" ON "UserProfile"("authUserId");

-- CreateIndex
CREATE INDEX "Pattern_levelOrder_idx" ON "Pattern"("levelOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Problem_url_key" ON "Problem"("url");

-- CreateIndex
CREATE INDEX "ProblemPattern_problemId_idx" ON "ProblemPattern"("problemId");

-- CreateIndex
CREATE INDEX "ProblemPattern_patternId_idx" ON "ProblemPattern"("patternId");

-- CreateIndex
CREATE INDEX "ProblemPattern_problemId_isPrimary_idx" ON "ProblemPattern"("problemId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemPattern_problemId_patternId_key" ON "ProblemPattern"("problemId", "patternId");

-- CreateIndex
CREATE INDEX "Attempt_userProfileId_idx" ON "Attempt"("userProfileId");

-- CreateIndex
CREATE INDEX "Attempt_problemId_idx" ON "Attempt"("problemId");

-- CreateIndex
CREATE INDEX "Attempt_selectedPatternId_idx" ON "Attempt"("selectedPatternId");

-- CreateIndex
CREATE INDEX "Attempt_correctPatternId_idx" ON "Attempt"("correctPatternId");

-- CreateIndex
CREATE INDEX "Attempt_userProfileId_problemId_idx" ON "Attempt"("userProfileId", "problemId");

-- CreateIndex
CREATE INDEX "Attempt_userProfileId_createdAt_idx" ON "Attempt"("userProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "ProblemPattern" ADD CONSTRAINT "ProblemPattern_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemPattern" ADD CONSTRAINT "ProblemPattern_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_selectedPatternId_fkey" FOREIGN KEY ("selectedPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_correctPatternId_fkey" FOREIGN KEY ("correctPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
