-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NotStarted', 'InProgress', 'Completed', 'Skipped');

-- CreateEnum
CREATE TYPE "CurrentLevel" AS ENUM ('Beginner', 'SomeExperience', 'InterviewPrep', 'Advanced');

-- CreateEnum
CREATE TYPE "PrimaryGoal" AS ENUM ('LearnPatterns', 'PrepareForInternships', 'PrepareForNewGrad', 'PrepareForBigTech', 'MaintainSkills', 'ImproveInterviewCommunication');

-- CreateEnum
CREATE TYPE "PreferredSessionLength" AS ENUM ('Short10', 'Medium25', 'Long45');

-- CreateEnum
CREATE TYPE "DiagnosticStatus" AS ENUM ('NotStarted', 'InProgress', 'Completed', 'Skipped');

-- CreateEnum
CREATE TYPE "DiagnosticQuestionType" AS ENUM ('PatternRecognition', 'ConfidenceCheck', 'GoalQuestion', 'ExperienceQuestion');

-- CreateEnum
CREATE TYPE "UserGoalStatus" AS ENUM ('Active', 'Completed', 'Paused', 'Abandoned');

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "preferredLanguage" "CodeLanguage" NOT NULL DEFAULT 'Python',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "dailyGoalMinutes" INTEGER NOT NULL DEFAULT 25,
    "targetInterviewDate" TIMESTAMP(3),
    "currentLevel" "CurrentLevel" NOT NULL DEFAULT 'Beginner',
    "primaryGoal" "PrimaryGoal" NOT NULL DEFAULT 'LearnPatterns',
    "preferredSessionLength" "PreferredSessionLength" NOT NULL DEFAULT 'Medium25',
    "voiceModeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "interviewerSpeechEnabled" BOOLEAN NOT NULL DEFAULT false,
    "storeVoiceTranscripts" BOOLEAN NOT NULL DEFAULT true,
    "storeRawAudio" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingState" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'NotStarted',
    "currentStep" TEXT NOT NULL DEFAULT 'welcome',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticAssessment" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "status" "DiagnosticStatus" NOT NULL DEFAULT 'NotStarted',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "overallLevel" "CurrentLevel",
    "recommendedStartPatternId" TEXT,
    "recommendedPlanId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticQuestion" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "questionType" "DiagnosticQuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "patternId" TEXT,
    "problemId" TEXT,
    "selectedAnswer" TEXT,
    "correctAnswer" TEXT,
    "wasCorrect" BOOLEAN,
    "confidence" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiagnosticQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserGoal" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3),
    "status" "UserGoalStatus" NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userProfileId_key" ON "UserSettings"("userProfileId");

-- CreateIndex
CREATE INDEX "UserSettings_preferredLanguage_idx" ON "UserSettings"("preferredLanguage");

-- CreateIndex
CREATE INDEX "UserSettings_currentLevel_idx" ON "UserSettings"("currentLevel");

-- CreateIndex
CREATE INDEX "UserSettings_primaryGoal_idx" ON "UserSettings"("primaryGoal");

-- CreateIndex
CREATE INDEX "UserSettings_createdAt_idx" ON "UserSettings"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingState_userProfileId_key" ON "OnboardingState"("userProfileId");

-- CreateIndex
CREATE INDEX "OnboardingState_status_idx" ON "OnboardingState"("status");

-- CreateIndex
CREATE INDEX "OnboardingState_currentStep_idx" ON "OnboardingState"("currentStep");

-- CreateIndex
CREATE INDEX "OnboardingState_createdAt_idx" ON "OnboardingState"("createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_userProfileId_idx" ON "DiagnosticAssessment"("userProfileId");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_status_idx" ON "DiagnosticAssessment"("status");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_startedAt_idx" ON "DiagnosticAssessment"("startedAt");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_completedAt_idx" ON "DiagnosticAssessment"("completedAt");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_recommendedStartPatternId_idx" ON "DiagnosticAssessment"("recommendedStartPatternId");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_recommendedPlanId_idx" ON "DiagnosticAssessment"("recommendedPlanId");

-- CreateIndex
CREATE INDEX "DiagnosticAssessment_createdAt_idx" ON "DiagnosticAssessment"("createdAt");

-- CreateIndex
CREATE INDEX "DiagnosticQuestion_assessmentId_idx" ON "DiagnosticQuestion"("assessmentId");

-- CreateIndex
CREATE INDEX "DiagnosticQuestion_questionType_idx" ON "DiagnosticQuestion"("questionType");

-- CreateIndex
CREATE INDEX "DiagnosticQuestion_patternId_idx" ON "DiagnosticQuestion"("patternId");

-- CreateIndex
CREATE INDEX "DiagnosticQuestion_problemId_idx" ON "DiagnosticQuestion"("problemId");

-- CreateIndex
CREATE INDEX "DiagnosticQuestion_createdAt_idx" ON "DiagnosticQuestion"("createdAt");

-- CreateIndex
CREATE INDEX "UserGoal_userProfileId_idx" ON "UserGoal"("userProfileId");

-- CreateIndex
CREATE INDEX "UserGoal_goalType_idx" ON "UserGoal"("goalType");

-- CreateIndex
CREATE INDEX "UserGoal_status_idx" ON "UserGoal"("status");

-- CreateIndex
CREATE INDEX "UserGoal_targetDate_idx" ON "UserGoal"("targetDate");

-- CreateIndex
CREATE INDEX "UserGoal_createdAt_idx" ON "UserGoal"("createdAt");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingState" ADD CONSTRAINT "OnboardingState_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAssessment" ADD CONSTRAINT "DiagnosticAssessment_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAssessment" ADD CONSTRAINT "DiagnosticAssessment_recommendedStartPatternId_fkey" FOREIGN KEY ("recommendedStartPatternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticAssessment" ADD CONSTRAINT "DiagnosticAssessment_recommendedPlanId_fkey" FOREIGN KEY ("recommendedPlanId") REFERENCES "LearningPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticQuestion" ADD CONSTRAINT "DiagnosticQuestion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "DiagnosticAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticQuestion" ADD CONSTRAINT "DiagnosticQuestion_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticQuestion" ADD CONSTRAINT "DiagnosticQuestion_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserGoal" ADD CONSTRAINT "UserGoal_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing users with v0.9 default settings and onboarding state.
INSERT INTO "UserSettings" (
    "id",
    "userProfileId",
    "preferredLanguage",
    "timezone",
    "dailyGoalMinutes",
    "currentLevel",
    "primaryGoal",
    "preferredSessionLength",
    "voiceModeEnabled",
    "interviewerSpeechEnabled",
    "storeVoiceTranscripts",
    "storeRawAudio",
    "createdAt",
    "updatedAt"
)
SELECT
    'uset_' || substr(md5("id" || clock_timestamp()::text || random()::text), 1, 20),
    "id",
    'Python'::"CodeLanguage",
    'UTC',
    25,
    'Beginner'::"CurrentLevel",
    'LearnPatterns'::"PrimaryGoal",
    'Medium25'::"PreferredSessionLength",
    false,
    false,
    true,
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "UserProfile"
ON CONFLICT ("userProfileId") DO NOTHING;

INSERT INTO "OnboardingState" (
    "id",
    "userProfileId",
    "status",
    "currentStep",
    "createdAt",
    "updatedAt"
)
SELECT
    'onb_' || substr(md5("id" || clock_timestamp()::text || random()::text), 1, 21),
    "id",
    'NotStarted'::"OnboardingStatus",
    'welcome',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "UserProfile"
ON CONFLICT ("userProfileId") DO NOTHING;
