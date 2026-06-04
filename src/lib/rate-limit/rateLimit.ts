import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";

import { getRateLimitConfig, type RateLimitKind } from "./limits";

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult =
  | {
      ok: true;
      limit: number;
      remaining: number;
      resetAt: Date;
    }
  | {
      ok: false;
      limit: number;
      remaining: 0;
      resetAt: Date;
      message: string;
    };

type CheckRateLimitInput = {
  kind: RateLimitKind;
  userProfileId?: string | null;
  fallbackKey?: string | null;
};

const buckets = new Map<string, Bucket>();

function buildIdentityKey({
  userProfileId,
  fallbackKey,
}: Pick<CheckRateLimitInput, "userProfileId" | "fallbackKey">) {
  if (userProfileId) {
    return `user:${userProfileId}`;
  }

  if (fallbackKey) {
    return `fallback:${fallbackKey}`;
  }

  return "fallback:anonymous";
}

function formatReset(resetAt: Date) {
  return resetAt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMessage(label: string, limit: number, resetAt: Date) {
  return `Daily ${label} limit reached (${limit.toLocaleString()}). Try again after ${formatReset(resetAt)}.`;
}

async function logRateLimitHit({
  kind,
  userProfileId,
  limit,
  resetAt,
}: {
  kind: RateLimitKind;
  userProfileId?: string | null;
  limit: number;
  resetAt: Date;
}) {
  await trackEvent({
    eventName: AnalyticsEvents.RateLimitHit,
    userProfileId: userProfileId ?? null,
    properties: {
      rateLimitKind: kind,
      limit,
      resetAt: resetAt.toISOString(),
    },
  });
}

export async function checkRateLimit({
  kind,
  userProfileId,
  fallbackKey,
}: CheckRateLimitInput): Promise<RateLimitResult> {
  try {
    const config = getRateLimitConfig(kind);
    const resetAt = new Date(Date.now() + config.windowMs);

    if (config.limit <= 0) {
      return {
        ok: false,
        limit: config.limit,
        remaining: 0,
        resetAt,
        message: `${config.label} are temporarily unavailable.`,
      };
    }

    const bucketKey = `${kind}:${buildIdentityKey({ userProfileId, fallbackKey })}`;
    const now = Date.now();
    const current = buckets.get(bucketKey);
    const bucket =
      current && current.resetAt > now
        ? current
        : {
            count: 0,
            resetAt: now + config.windowMs,
          };

    if (bucket.count >= config.limit) {
      const limitResetAt = new Date(bucket.resetAt);

      await logRateLimitHit({
        kind,
        userProfileId,
        limit: config.limit,
        resetAt: limitResetAt,
      });

      return {
        ok: false,
        limit: config.limit,
        remaining: 0,
        resetAt: limitResetAt,
        message: getMessage(config.label, config.limit, limitResetAt),
      };
    }

    bucket.count += 1;
    buckets.set(bucketKey, bucket);

    return {
      ok: true,
      limit: config.limit,
      remaining: Math.max(0, config.limit - bucket.count),
      resetAt: new Date(bucket.resetAt),
    };
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("PatternForge rate limit check failed open.", error);
    }

    return {
      ok: true,
      limit: Number.POSITIVE_INFINITY,
      remaining: Number.POSITIVE_INFINITY,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }
}
