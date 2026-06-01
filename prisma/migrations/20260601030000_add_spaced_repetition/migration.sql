-- CreateEnum
CREATE TYPE "ReviewItemType" AS ENUM ('Flashcard', 'Mistake');

-- CreateEnum
CREATE TYPE "ReviewRating" AS ENUM ('Again', 'Hard', 'Good', 'Easy');

-- AlterTable
ALTER TABLE "Mistake" ADD COLUMN "reviewDueAt" TIMESTAMP(3);
ALTER TABLE "Mistake" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "Mistake" ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mistake" ADD COLUMN "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "Mistake" ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mistake" ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Mistake" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- Backfill existing v0.2 mistakes before enforcing the required due date.
UPDATE "Mistake"
SET "reviewDueAt" = "createdAt"
WHERE "reviewDueAt" IS NULL;

ALTER TABLE "Mistake" ALTER COLUMN "reviewDueAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "Flashcard" ADD COLUMN "reviewDueAt" TIMESTAMP(3);
ALTER TABLE "Flashcard" ADD COLUMN "lastReviewedAt" TIMESTAMP(3);
ALTER TABLE "Flashcard" ADD COLUMN "intervalDays" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Flashcard" ADD COLUMN "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5;
ALTER TABLE "Flashcard" ADD COLUMN "repetitions" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Flashcard" ADD COLUMN "lapses" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Flashcard" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- Backfill existing v0.2 flashcards before enforcing the required due date.
UPDATE "Flashcard"
SET "reviewDueAt" = "createdAt"
WHERE "reviewDueAt" IS NULL;

ALTER TABLE "Flashcard" ALTER COLUMN "reviewDueAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "ReviewLog" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT NOT NULL,
    "flashcardId" TEXT,
    "mistakeId" TEXT,
    "itemType" "ReviewItemType" NOT NULL,
    "rating" "ReviewRating" NOT NULL,
    "previousIntervalDays" INTEGER NOT NULL,
    "nextIntervalDays" INTEGER NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Mistake_reviewDueAt_idx" ON "Mistake"("reviewDueAt");

-- CreateIndex
CREATE INDEX "Flashcard_reviewDueAt_idx" ON "Flashcard"("reviewDueAt");

-- CreateIndex
CREATE INDEX "ReviewLog_userProfileId_idx" ON "ReviewLog"("userProfileId");

-- CreateIndex
CREATE INDEX "ReviewLog_reviewedAt_idx" ON "ReviewLog"("reviewedAt");

-- CreateIndex
CREATE INDEX "ReviewLog_flashcardId_idx" ON "ReviewLog"("flashcardId");

-- CreateIndex
CREATE INDEX "ReviewLog_mistakeId_idx" ON "ReviewLog"("mistakeId");

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_userProfileId_fkey" FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_mistakeId_fkey" FOREIGN KEY ("mistakeId") REFERENCES "Mistake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
