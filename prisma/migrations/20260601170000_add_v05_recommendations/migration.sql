-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('DueReview', 'FocusPattern', 'ContrastDrill', 'RetryProblem', 'BossBattle', 'ReviewGauntlet', 'AIReviewFollowUp', 'LearningPlanStep', 'DailyForge');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('Active', 'Accepted', 'Completed', 'Dismissed', 'Expired');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('WeakPattern', 'StrongPattern', 'ConfusingPattern', 'RetentionRisk', 'ReadyForBoss', 'Plateau', 'NeedsReview', 'NeedsImplementationPractice');

-- CreateEnum
CREATE TYPE "InsightSeverity" AS ENUM ('Low', 'Medium', 'High');

-- CreateEnum
CREATE TYPE "LearningPlanStatus" AS ENUM ('Active', 'Completed', 'Paused', 'Abandoned');

-- CreateEnum
CREATE TYPE "LearningPlanStepStatus" AS ENUM ('Pending', 'Active', 'Completed', 'Skipped');

-- CreateEnum
CREATE TYPE "RecommendationFeedbackType" AS ENUM ('Accepted', 'Dismissed', 'TooEasy', 'TooHard', 'NotRelevant', 'Helpful');

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "priority" INTEGER NOT NULL,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'Active',
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "targetPatternId" TEXT,
    "secondaryPatternId" TEXT,
    "problemId" TEXT,
    "battleType" "BattleType",
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternInsight" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "insightType" "InsightType" NOT NULL,
    "severity" "InsightSeverity" NOT NULL,
    "summary" TEXT NOT NULL,
    "evidence" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatternConfusion" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "selectedPatternId" TEXT NOT NULL,
    "correctPatternId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatternConfusion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "status" "LearningPlanStatus" NOT NULL DEFAULT 'Active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanStep" (
    "id" TEXT NOT NULL,
    "learningPlanId" TEXT NOT NULL,
    "dayIndex" INTEGER NOT NULL,
    "stepType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetPatternId" TEXT,
    "problemId" TEXT,
    "targetCount" INTEGER,
    "status" "LearningPlanStepStatus" NOT NULL DEFAULT 'Pending',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningPlanStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "feedbackType" "RecommendationFeedbackType" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recommendation_userProfileId_idx" ON "Recommendation"("userProfileId");

-- CreateIndex
CREATE INDEX "Recommendation_recommendationType_idx" ON "Recommendation"("recommendationType");

-- CreateIndex
CREATE INDEX "Recommendation_status_idx" ON "Recommendation"("status");

-- CreateIndex
CREATE INDEX "Recommendation_priority_idx" ON "Recommendation"("priority");

-- CreateIndex
CREATE INDEX "Recommendation_targetPatternId_idx" ON "Recommendation"("targetPatternId");

-- CreateIndex
CREATE INDEX "Recommendation_secondaryPatternId_idx" ON "Recommendation"("secondaryPatternId");

-- CreateIndex
CREATE INDEX "Recommendation_problemId_idx" ON "Recommendation"("problemId");

-- CreateIndex
CREATE INDEX "Recommendation_createdAt_idx" ON "Recommendation"("createdAt");

-- CreateIndex
CREATE INDEX "PatternInsight_userProfileId_idx" ON "PatternInsight"("userProfileId");

-- CreateIndex
CREATE INDEX "PatternInsight_patternId_idx" ON "PatternInsight"("patternId");

-- CreateIndex
CREATE INDEX "PatternInsight_insightType_idx" ON "PatternInsight"("insightType");

-- CreateIndex
CREATE INDEX "PatternInsight_severity_idx" ON "PatternInsight"("severity");

-- CreateIndex
CREATE INDEX "PatternInsight_createdAt_idx" ON "PatternInsight"("createdAt");

-- CreateIndex
CREATE INDEX "PatternConfusion_userProfileId_idx" ON "PatternConfusion"("userProfileId");

-- CreateIndex
CREATE INDEX "PatternConfusion_selectedPatternId_idx" ON "PatternConfusion"("selectedPatternId");

-- CreateIndex
CREATE INDEX "PatternConfusion_correctPatternId_idx" ON "PatternConfusion"("correctPatternId");

-- CreateIndex
CREATE INDEX "PatternConfusion_createdAt_idx" ON "PatternConfusion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PatternConfusion_userProfileId_selectedPatternId_correctPat_key" ON "PatternConfusion"("userProfileId", "selectedPatternId", "correctPatternId");

-- CreateIndex
CREATE INDEX "LearningPlan_userProfileId_idx" ON "LearningPlan"("userProfileId");

-- CreateIndex
CREATE INDEX "LearningPlan_status_idx" ON "LearningPlan"("status");

-- CreateIndex
CREATE INDEX "LearningPlan_startDate_idx" ON "LearningPlan"("startDate");

-- CreateIndex
CREATE INDEX "LearningPlan_createdAt_idx" ON "LearningPlan"("createdAt");

-- CreateIndex
CREATE INDEX "LearningPlanStep_learningPlanId_idx" ON "LearningPlanStep"("learningPlanId");

-- CreateIndex
CREATE INDEX "LearningPlanStep_targetPatternId_idx" ON "LearningPlanStep"("targetPatternId");

-- CreateIndex
CREATE INDEX "LearningPlanStep_problemId_idx" ON "LearningPlanStep"("problemId");

-- CreateIndex
CREATE INDEX "LearningPlanStep_status_idx" ON "LearningPlanStep"("status");

-- CreateIndex
CREATE INDEX "LearningPlanStep_dueDate_idx" ON "LearningPlanStep"("dueDate");

-- CreateIndex
CREATE INDEX "LearningPlanStep_createdAt_idx" ON "LearningPlanStep"("createdAt");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userProfileId_idx" ON "RecommendationFeedback"("userProfileId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_recommendationId_idx" ON "RecommendationFeedback"("recommendationId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_feedbackType_idx" ON "RecommendationFeedback"("feedbackType");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_createdAt_idx" ON "RecommendationFeedback"("createdAt");

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_targetPatternId_fkey" FOREIGN KEY ("targetPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_secondaryPatternId_fkey" FOREIGN KEY ("secondaryPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternInsight" ADD CONSTRAINT "PatternInsight_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternInsight" ADD CONSTRAINT "PatternInsight_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternConfusion" ADD CONSTRAINT "PatternConfusion_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternConfusion" ADD CONSTRAINT "PatternConfusion_selectedPatternId_fkey" FOREIGN KEY ("selectedPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatternConfusion" ADD CONSTRAINT "PatternConfusion_correctPatternId_fkey" FOREIGN KEY ("correctPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanStep" ADD CONSTRAINT "LearningPlanStep_learningPlanId_fkey" FOREIGN KEY ("learningPlanId") REFERENCES "LearningPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanStep" ADD CONSTRAINT "LearningPlanStep_targetPatternId_fkey" FOREIGN KEY ("targetPatternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanStep" ADD CONSTRAINT "LearningPlanStep_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
