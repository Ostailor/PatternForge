export type RateLimitKind =
  | "aiReview"
  | "hints"
  | "debugCoach"
  | "aiInterviewer"
  | "interviewScoring"
  | "communicationScoring"
  | "speechTranscription"
  | "textToSpeech"
  | "codeRuns"
  | "feedback";

export type RateLimitConfig = {
  limit: number;
  windowMs: number;
  env: string;
  label: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const rateLimitDefaults: Record<RateLimitKind, RateLimitConfig> = {
  aiReview: {
    limit: 20,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_AI_REVIEWS_PER_DAY",
    label: "AI reviews",
  },
  hints: {
    limit: 50,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_HINTS_PER_DAY",
    label: "AI hints",
  },
  debugCoach: {
    limit: 30,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_DEBUG_COACH_PER_DAY",
    label: "Debug Coach requests",
  },
  aiInterviewer: {
    limit: 80,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_AI_INTERVIEWER_PER_DAY",
    label: "AI interviewer turns",
  },
  interviewScoring: {
    limit: 20,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_INTERVIEW_SCORING_PER_DAY",
    label: "interview scoring requests",
  },
  communicationScoring: {
    limit: 40,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_COMMUNICATION_SCORING_PER_DAY",
    label: "communication scoring requests",
  },
  speechTranscription: {
    limit: 60,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_VOICE_TRANSCRIPTIONS_PER_DAY",
    label: "voice transcriptions",
  },
  textToSpeech: {
    limit: 200,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_TEXT_TO_SPEECH_PER_DAY",
    label: "text-to-speech requests",
  },
  codeRuns: {
    limit: 100,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_CODE_RUNS_PER_DAY",
    label: "code runs",
  },
  feedback: {
    limit: 10,
    windowMs: DAY_MS,
    env: "PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY",
    label: "feedback submissions",
  },
};

export function getRateLimitConfig(kind: RateLimitKind): RateLimitConfig {
  const config = rateLimitDefaults[kind];
  const envValue = process.env[config.env];
  const parsedLimit =
    typeof envValue === "string" ? Number.parseInt(envValue, 10) : NaN;

  return {
    ...config,
    limit:
      Number.isInteger(parsedLimit) && parsedLimit >= 0
        ? parsedLimit
        : config.limit,
  };
}
