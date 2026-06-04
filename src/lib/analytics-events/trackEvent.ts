import { Prisma } from "@/generated/prisma/client";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";

import { analyticsEventNames } from "./events";
import type {
  AnalyticsProperties,
  AnalyticsPropertyValue,
  TrackEventInput,
} from "./types";

const bannedExactPropertyNames = [
  "answer",
  "audio",
  "back",
  "code",
  "content",
  "correction",
  "description",
  "feedback",
  "front",
  "input",
  "message",
  "note",
  "output",
  "prompt",
  "raw",
  "reflection",
  "stderr",
  "stdout",
  "summary",
  "text",
  "transcript",
];

const bannedPropertySuffixes = [
  "answer",
  "audio",
  "back",
  "code",
  "content",
  "correction",
  "description",
  "explanation",
  "feedback",
  "front",
  "input",
  "message",
  "note",
  "output",
  "prompt",
  "raw",
  "reflection",
  "stderr",
  "stdout",
  "summary",
  "text",
  "transcript",
];

function isValidEventName(eventName: string) {
  return analyticsEventNames.includes(
    eventName as (typeof analyticsEventNames)[number],
  );
}

function isAllowedPropertyKey(key: string) {
  const normalized = key.toLowerCase();

  return (
    !bannedExactPropertyNames.includes(normalized) &&
    !bannedPropertySuffixes.some((suffix) => normalized.endsWith(suffix))
  );
}

function isAllowedPropertyValue(
  value: AnalyticsProperties[string],
): value is AnalyticsPropertyValue {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties = {},
): Prisma.InputJsonObject {
  const safeProperties = Object.entries(properties).reduce<
    Record<string, Prisma.InputJsonValue>
  >(
    (safeProperties, [key, value]) => {
      if (!isAllowedPropertyKey(key) || !isAllowedPropertyValue(value)) {
        return safeProperties;
      }

      safeProperties[key] =
        typeof value === "string" ? value.slice(0, 160) : value;

      return safeProperties;
    },
    {},
  );

  return safeProperties as Prisma.InputJsonObject;
}

export async function trackEvent({
  eventName,
  userProfileId,
  properties,
  client,
}: TrackEventInput): Promise<void> {
  if (!getFeatureFlag("analytics") || !isValidEventName(eventName)) {
    return;
  }

  const prisma = client ?? getPrisma();

  try {
    if (userProfileId) {
      const settings = await prisma.userSettings.findUnique({
        where: { userProfileId },
        select: { analyticsOptOut: true },
      });

      if (settings?.analyticsOptOut) {
        return;
      }
    }

    await prisma.analyticsEvent.create({
      data: {
        userProfileId: userProfileId ?? null,
        eventName,
        properties: sanitizeAnalyticsProperties(properties),
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("PatternForge analytics event was not recorded.", error);
    }
  }
}
