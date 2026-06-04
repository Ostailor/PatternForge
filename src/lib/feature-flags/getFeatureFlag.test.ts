import assert from "node:assert/strict";
import test from "node:test";

import { featureFlags, type FeatureFlagKey } from "@/lib/feature-flags/flags";
import {
  getFeatureFlag,
  getFeatureFlags,
} from "@/lib/feature-flags/getFeatureFlag";

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

test("feature flags use defaults when no environment override is set", async () => {
  await withEnv(
    Object.fromEntries(
      Object.values(featureFlags).flatMap((flag) => [
        [flag.env, undefined],
        ["legacyDisableEnv" in flag ? flag.legacyDisableEnv : "", undefined],
      ]),
    ),
    () => {
      assert.equal(getFeatureFlag("aiCoach"), true);
      assert.equal(getFeatureFlag("adminTools"), false);
    },
  );
});

test("feature flags parse explicit enabled and disabled values", async () => {
  await withEnv(
    {
      PATTERNFORGE_FEATURE_AI_COACH: "off",
      PATTERNFORGE_FEATURE_ADMIN_TOOLS: "YES",
    },
    () => {
      assert.equal(getFeatureFlag("aiCoach"), false);
      assert.equal(getFeatureFlag("adminTools"), true);
    },
  );
});

test("analytics honors legacy disable env when no explicit flag is set", async () => {
  await withEnv(
    {
      PATTERNFORGE_FEATURE_ANALYTICS: undefined,
      PATTERNFORGE_ANALYTICS_DISABLED: "true",
    },
    () => {
      assert.equal(getFeatureFlag("analytics"), false);
    },
  );
});

test("getFeatureFlags returns a keyed subset", async () => {
  await withEnv(
    {
      PATTERNFORGE_FEATURE_CODE_RUNNER: "0",
      PATTERNFORGE_FEATURE_VOICE_MODE: "1",
    },
    () => {
      assert.deepEqual(
        getFeatureFlags(["codeRunner", "voiceMode"] satisfies FeatureFlagKey[]),
        {
          codeRunner: false,
          voiceMode: true,
        },
      );
    },
  );
});
