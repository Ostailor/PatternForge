import type { Prisma } from "@/generated/prisma/client";

import type { AnalyticsEventName } from "./events";

export type AnalyticsPropertyValue = string | number | boolean;

export type AnalyticsProperties = Record<
  string,
  AnalyticsPropertyValue | undefined
>;

export type AnalyticsClient = Prisma.TransactionClient | ReturnType<
  typeof import("@/lib/prisma").getPrisma
>;

export type TrackEventInput = {
  eventName: AnalyticsEventName;
  userProfileId?: string | null;
  properties?: AnalyticsProperties;
  client?: AnalyticsClient;
};
