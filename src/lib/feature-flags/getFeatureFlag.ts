import { featureFlags, type FeatureFlagKey } from "./flags";

const enabledValues = new Set(["1", "true", "yes", "on", "enabled"]);
const disabledValues = new Set(["0", "false", "no", "off", "disabled"]);

function parseFlagValue(value: string | undefined): boolean | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (enabledValues.has(normalized)) {
    return true;
  }

  if (disabledValues.has(normalized)) {
    return false;
  }

  return null;
}

export function getFeatureFlag(flag: FeatureFlagKey): boolean {
  const config = featureFlags[flag];
  const explicitValue = parseFlagValue(process.env[config.env]);

  if (explicitValue !== null) {
    return explicitValue;
  }

  if (
    "legacyDisableEnv" in config &&
    parseFlagValue(process.env[config.legacyDisableEnv]) === true
  ) {
    return false;
  }

  return config.defaultEnabled;
}

export function getFeatureFlags(
  flags: FeatureFlagKey[],
): Partial<Record<FeatureFlagKey, boolean>> {
  const values: Partial<Record<FeatureFlagKey, boolean>> = {};

  for (const flag of flags) {
    values[flag] = getFeatureFlag(flag);
  }

  return values;
}
