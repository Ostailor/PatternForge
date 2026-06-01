-- CreateEnum
CREATE TYPE "BattleType" AS ENUM ('PatternBoss', 'MixedBattle', 'ReviewGauntlet');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('Active', 'Completed', 'Abandoned');

-- CreateEnum
CREATE TYPE "BattleResult" AS ENUM ('Victory', 'PartialVictory', 'Defeat');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('Warmup', 'MainForge', 'PatternTwist', 'MixedReview', 'BossProblem');

-- CreateEnum
CREATE TYPE "QuestStatus" AS ENUM ('Active', 'Completed', 'Expired');

-- CreateEnum
CREATE TYPE "GameEventType" AS ENUM ('AttemptCompleted', 'ReviewCompleted', 'BattleCompleted', 'QuestCompleted', 'AchievementEarned');

-- CreateTable
CREATE TABLE "Battle" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "battleType" "BattleType" NOT NULL,
    "title" TEXT NOT NULL,
    "targetPatternId" TEXT,
    "status" "BattleStatus" NOT NULL DEFAULT 'Active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "totalRounds" INTEGER NOT NULL,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "result" "BattleResult",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleRound" (
    "id" TEXT NOT NULL,
    "battleId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundType" "RoundType" NOT NULL,
    "expectedPatternId" TEXT NOT NULL,
    "attemptId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BattleRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quest" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "questType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "status" "QuestStatus" NOT NULL DEFAULT 'Active',
    "date" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "eventType" "GameEventType" NOT NULL,
    "xpAmount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "eventKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Battle_userProfileId_idx" ON "Battle"("userProfileId");

-- CreateIndex
CREATE INDEX "Battle_targetPatternId_idx" ON "Battle"("targetPatternId");

-- CreateIndex
CREATE INDEX "Battle_status_idx" ON "Battle"("status");

-- CreateIndex
CREATE INDEX "Battle_createdAt_idx" ON "Battle"("createdAt");

-- CreateIndex
CREATE INDEX "BattleRound_battleId_idx" ON "BattleRound"("battleId");

-- CreateIndex
CREATE INDEX "BattleRound_problemId_idx" ON "BattleRound"("problemId");

-- CreateIndex
CREATE INDEX "BattleRound_expectedPatternId_idx" ON "BattleRound"("expectedPatternId");

-- CreateIndex
CREATE INDEX "BattleRound_attemptId_idx" ON "BattleRound"("attemptId");

-- CreateIndex
CREATE INDEX "BattleRound_createdAt_idx" ON "BattleRound"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BattleRound_battleId_roundNumber_key" ON "BattleRound"("battleId", "roundNumber");

-- CreateIndex
CREATE INDEX "Quest_userProfileId_idx" ON "Quest"("userProfileId");

-- CreateIndex
CREATE INDEX "Quest_status_idx" ON "Quest"("status");

-- CreateIndex
CREATE INDEX "Quest_date_idx" ON "Quest"("date");

-- CreateIndex
CREATE INDEX "Quest_createdAt_idx" ON "Quest"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_key_key" ON "Achievement"("key");

-- CreateIndex
CREATE INDEX "Achievement_createdAt_idx" ON "Achievement"("createdAt");

-- CreateIndex
CREATE INDEX "UserAchievement_userProfileId_idx" ON "UserAchievement"("userProfileId");

-- CreateIndex
CREATE INDEX "UserAchievement_achievementId_idx" ON "UserAchievement"("achievementId");

-- CreateIndex
CREATE INDEX "UserAchievement_earnedAt_idx" ON "UserAchievement"("earnedAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userProfileId_achievementId_key" ON "UserAchievement"("userProfileId", "achievementId");

-- CreateIndex
CREATE INDEX "GameEvent_userProfileId_idx" ON "GameEvent"("userProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "GameEvent_eventKey_key" ON "GameEvent"("eventKey");

-- CreateIndex
CREATE INDEX "GameEvent_eventType_idx" ON "GameEvent"("eventType");

-- CreateIndex
CREATE INDEX "GameEvent_createdAt_idx" ON "GameEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_targetPatternId_fkey" FOREIGN KEY ("targetPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRound" ADD CONSTRAINT "BattleRound_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRound" ADD CONSTRAINT "BattleRound_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRound" ADD CONSTRAINT "BattleRound_expectedPatternId_fkey" FOREIGN KEY ("expectedPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BattleRound" ADD CONSTRAINT "BattleRound_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameEvent" ADD CONSTRAINT "GameEvent_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
