export const featureFlags = {
  aiCoach: {
    env: "PATTERNFORGE_FEATURE_AI_COACH",
    defaultEnabled: true,
  },
  codeRunner: {
    env: "PATTERNFORGE_FEATURE_CODE_RUNNER",
    defaultEnabled: true,
  },
  voiceMode: {
    env: "PATTERNFORGE_FEATURE_VOICE_MODE",
    defaultEnabled: true,
  },
  interviews: {
    env: "PATTERNFORGE_FEATURE_INTERVIEWS",
    defaultEnabled: true,
  },
  bossBattles: {
    env: "PATTERNFORGE_FEATURE_BOSS_BATTLES",
    defaultEnabled: true,
  },
  recommendations: {
    env: "PATTERNFORGE_FEATURE_RECOMMENDATIONS",
    defaultEnabled: true,
  },
  analytics: {
    env: "PATTERNFORGE_FEATURE_ANALYTICS",
    defaultEnabled: true,
    legacyDisableEnv: "PATTERNFORGE_ANALYTICS_DISABLED",
  },
  betaFeedback: {
    env: "PATTERNFORGE_FEATURE_BETA_FEEDBACK",
    defaultEnabled: true,
  },
  adminTools: {
    env: "PATTERNFORGE_FEATURE_ADMIN_TOOLS",
    defaultEnabled: false,
  },
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

export const featureFlagKeys = Object.keys(featureFlags) as FeatureFlagKey[];
