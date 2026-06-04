-- Add privacy-conscious product analytics event storage.
ALTER TABLE "UserSettings" ADD COLUMN "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userProfileId" TEXT,
    "eventName" TEXT NOT NULL,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AnalyticsEvent_userProfileId_idx" ON "AnalyticsEvent"("userProfileId");
CREATE INDEX "AnalyticsEvent_eventName_idx" ON "AnalyticsEvent"("eventName");
CREATE INDEX "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent"("createdAt");
CREATE INDEX "AnalyticsEvent_eventName_createdAt_idx" ON "AnalyticsEvent"("eventName", "createdAt");

ALTER TABLE "AnalyticsEvent"
ADD CONSTRAINT "AnalyticsEvent_userProfileId_fkey"
FOREIGN KEY ("userProfileId") REFERENCES "UserProfile"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
