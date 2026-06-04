-- Add beta-user feedback storage.
CREATE TYPE "FeedbackType" AS ENUM (
    'Bug',
    'Confusing',
    'FeatureRequest',
    'Praise',
    'Other'
);

CREATE TYPE "FeedbackStatus" AS ENUM (
    'New',
    'Reviewed',
    'Planned',
    'Closed'
);

CREATE TABLE "UserFeedback" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT,
    "feedbackType" "FeedbackType" NOT NULL,
    "pagePath" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rating" INTEGER,
    "metadata" JSONB,
    "status" "FeedbackStatus" NOT NULL DEFAULT 'New',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserFeedback_userProfileId_idx" ON "UserFeedback"("userProfileId");
CREATE INDEX "UserFeedback_feedbackType_idx" ON "UserFeedback"("feedbackType");
CREATE INDEX "UserFeedback_status_idx" ON "UserFeedback"("status");
CREATE INDEX "UserFeedback_createdAt_idx" ON "UserFeedback"("createdAt");

ALTER TABLE "UserFeedback"
ADD CONSTRAINT "UserFeedback_userProfileId_fkey"
FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
