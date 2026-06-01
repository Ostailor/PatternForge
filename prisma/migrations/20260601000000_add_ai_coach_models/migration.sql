-- CreateTable
CREATE TABLE "AIReview" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "patternScore" INTEGER NOT NULL,
    "implementationScore" INTEGER NOT NULL,
    "complexityScore" INTEGER NOT NULL,
    "explanationScore" INTEGER NOT NULL,
    "feedbackSummary" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "weaknesses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "complexityFeedback" TEXT NOT NULL,
    "suggestedNextStep" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mistake" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "mistakeType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "correction" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mistake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "sourceAttemptId" TEXT,
    "patternId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIReview_userProfileId_idx" ON "AIReview"("userProfileId");

-- CreateIndex
CREATE INDEX "AIReview_attemptId_idx" ON "AIReview"("attemptId");

-- CreateIndex
CREATE INDEX "AIReview_problemId_idx" ON "AIReview"("problemId");

-- CreateIndex
CREATE INDEX "AIReview_patternId_idx" ON "AIReview"("patternId");

-- CreateIndex
CREATE INDEX "AIReview_createdAt_idx" ON "AIReview"("createdAt");

-- CreateIndex
CREATE INDEX "Mistake_userProfileId_idx" ON "Mistake"("userProfileId");

-- CreateIndex
CREATE INDEX "Mistake_attemptId_idx" ON "Mistake"("attemptId");

-- CreateIndex
CREATE INDEX "Mistake_problemId_idx" ON "Mistake"("problemId");

-- CreateIndex
CREATE INDEX "Mistake_patternId_idx" ON "Mistake"("patternId");

-- CreateIndex
CREATE INDEX "Mistake_createdAt_idx" ON "Mistake"("createdAt");

-- CreateIndex
CREATE INDEX "Flashcard_userProfileId_idx" ON "Flashcard"("userProfileId");

-- CreateIndex
CREATE INDEX "Flashcard_sourceAttemptId_idx" ON "Flashcard"("sourceAttemptId");

-- CreateIndex
CREATE INDEX "Flashcard_patternId_idx" ON "Flashcard"("patternId");

-- CreateIndex
CREATE INDEX "Flashcard_createdAt_idx" ON "Flashcard"("createdAt");

-- AddForeignKey
ALTER TABLE "AIReview" ADD CONSTRAINT "AIReview_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReview" ADD CONSTRAINT "AIReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReview" ADD CONSTRAINT "AIReview_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIReview" ADD CONSTRAINT "AIReview_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "Problem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mistake" ADD CONSTRAINT "Mistake_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_sourceAttemptId_fkey" FOREIGN KEY ("sourceAttemptId") REFERENCES "Attempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
