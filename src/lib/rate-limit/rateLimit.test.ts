import assert from "node:assert/strict";
import test from "node:test";

import { getRateLimitConfig } from "@/lib/rate-limit/limits";
import { checkRateLimit } from "@/lib/rate-limit/rateLimit";

async function withEnv<T>(
  values: Record<string, string | undefined>,
  callback: () => T | Promise<T>,
): Promise<T> {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  try {
    return await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test("rate limit config uses env overrides and ignores invalid values", async () => {
  await withEnv(
    {
      PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY: "3",
    },
    () => {
      assert.equal(getRateLimitConfig("feedback").limit, 3);
    },
  );

  await withEnv(
    {
      PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY: "-1",
    },
    () => {
      assert.equal(getRateLimitConfig("feedback").limit, 10);
    },
  );
});

test("checkRateLimit tracks separate user and fallback buckets", async () => {
  await withEnv(
    {
      PATTERNFORGE_FEATURE_ANALYTICS: "false",
      PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY: "1",
    },
    async () => {
      const key = `unit-${Date.now()}-${Math.random()}`;
      const firstUser = await checkRateLimit({
        kind: "feedback",
        userProfileId: `${key}-user`,
      });
      const secondUser = await checkRateLimit({
        kind: "feedback",
        userProfileId: `${key}-user`,
      });
      const fallback = await checkRateLimit({
        kind: "feedback",
        fallbackKey: `${key}-fallback`,
      });

      assert.equal(firstUser.ok, true);
      assert.equal(firstUser.remaining, 0);
      assert.equal(secondUser.ok, false);
      assert.match(secondUser.message, /Daily feedback submissions limit reached/);
      assert.equal(fallback.ok, true);
    },
  );
});

test("zero limit returns a friendly unavailable response", async () => {
  await withEnv(
    {
      PATTERNFORGE_RATE_LIMIT_CODE_RUNS_PER_DAY: "0",
    },
    async () => {
      const result = await checkRateLimit({
        kind: "codeRuns",
        userProfileId: `zero-${Date.now()}`,
      });

      assert.equal(result.ok, false);
      assert.equal(result.message, "code runs are temporarily unavailable.");
    },
  );
});
