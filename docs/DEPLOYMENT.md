# PatternForge v0.9 Production Deployment Checklist

Use this checklist before opening PatternForge v0.9 to real beta users.

## Environment Variables

Required:

- [ ] `DATABASE_URL` points to the production PostgreSQL database.
- [ ] Auth provider keys are configured:
  - [ ] `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - [ ] `CLERK_SECRET_KEY`
- [ ] App URL is configured in the hosting/auth provider settings. If the
      deployment platform uses an app URL env var, set it consistently for
      redirects, callbacks, and generated links.

AI provider, if enabled:

- [ ] `AI_PROVIDER`
- [ ] `AI_BASE_URL`
- [ ] `AI_API_KEY`
- [ ] `AI_MODEL`
- [ ] AI keys are server-side only. Do not prefix AI secrets with
      `NEXT_PUBLIC_`.

Speech provider, if enabled:

- [ ] `SPEECH_PROVIDER`
- [ ] Any provider-specific speech-to-text key is configured server-side.
- [ ] Any provider-specific text-to-speech key is configured server-side.

Feature flags:

- [ ] `PATTERNFORGE_FEATURE_AI_COACH`
- [ ] `PATTERNFORGE_FEATURE_CODE_RUNNER`
- [ ] `PATTERNFORGE_FEATURE_VOICE_MODE`
- [ ] `PATTERNFORGE_FEATURE_INTERVIEWS`
- [ ] `PATTERNFORGE_FEATURE_BOSS_BATTLES`
- [ ] `PATTERNFORGE_FEATURE_RECOMMENDATIONS`
- [ ] `PATTERNFORGE_FEATURE_ANALYTICS`
- [ ] `PATTERNFORGE_FEATURE_BETA_FEEDBACK`
- [ ] `PATTERNFORGE_FEATURE_ADMIN_TOOLS`

Code runner:

- [ ] `CODE_RUNNER_MODE` is set to one of:
  - [ ] `disabled` for safest beta launch.
  - [ ] `sandbox` only when an isolated sandbox provider is configured.
- [ ] `CODE_RUNNER_MODE=local-dev` is not used in production.

Rate limits:

- [ ] `PATTERNFORGE_RATE_LIMIT_AI_REVIEWS_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_HINTS_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_DEBUG_COACH_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_AI_INTERVIEWER_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_INTERVIEW_SCORING_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_COMMUNICATION_SCORING_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_VOICE_TRANSCRIPTIONS_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_TEXT_TO_SPEECH_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_CODE_RUNS_PER_DAY`
- [ ] `PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY`

## Database

- [ ] Confirm production `DATABASE_URL` targets the intended database.
- [ ] Run migrations:

```bash
npx prisma migrate deploy
```

- [ ] Run seed for PatternForge metadata:

```bash
npx prisma db seed
```

- [ ] Validate seed data locally or in CI:

```bash
npm run validate:data
```

- [ ] Verify indexes exist for v0.9 performance paths:
  - [ ] User-scoped attempts/history by time.
  - [ ] Due flashcards and mistakes.
  - [ ] Review logs by user/time.
  - [ ] Recommendations by user/status/priority/time.
  - [ ] Code submissions/runs by user/time/status.
  - [ ] Voice sessions/turns by user/session/time.
  - [ ] Analytics events by time and user/time.
  - [ ] Feedback by status/time and user/time.
- [ ] Confirm backup plan if applicable:
  - [ ] Automated backups enabled.
  - [ ] Restore procedure documented.
  - [ ] Restore tested against a non-production database.

## Security

- [ ] Auth-required routes reject signed-out users.
- [ ] Auth callback and redirect URLs match the production app URL.
- [ ] User-owned resources enforce ownership checks:
  - [ ] Attempts and AI reviews.
  - [ ] Mistakes, flashcards, and review logs.
  - [ ] Battles and battle rounds.
  - [ ] Interviews, messages, scoring, and summaries.
  - [ ] Code submissions and code runs.
  - [ ] Voice sessions, turns, feedback, and transcripts.
  - [ ] Settings, export, and deletion controls.
- [ ] API keys are never exposed to client bundles.
- [ ] Code runner is disabled or sandboxed.
- [ ] Production code execution never uses `local-dev` runner mode.
- [ ] Rate limits are enabled for AI, speech, code execution, and feedback.
- [ ] Error messages do not leak stack traces, provider payloads, internal IDs,
      secrets, filesystem paths, or sandbox internals.
- [ ] Data export excludes secrets and provider metadata.
- [ ] Destructive settings actions require confirmation.

## AI

- [ ] Provider keys are configured.
- [ ] AI feature flag is intentionally set.
- [ ] AI rate limits are configured.
- [ ] Input-size validation is active for prompts and user content.
- [ ] Malformed provider output falls back gracefully.
- [ ] AI review fallback works when the provider is unavailable.
- [ ] Hints/debug/interviewer/scoring failures show safe user-facing messages.
- [ ] No prompt path stores unnecessary raw provider responses.
- [ ] Product copy does not claim official LeetCode judging or official test
      passing.

## Voice

- [ ] Voice Mode feature flag is intentionally set.
- [ ] Transcript storage behavior is explained in Settings and transcript views.
- [ ] Transcript deletion works for the current user only.
- [ ] Raw audio storage remains disabled unless explicitly configured.
- [ ] Speech provider failures fall back to text mode.
- [ ] Text-to-speech is optional and failure does not block interview progress.
- [ ] Communication scoring does not claim tone, emotion, or audio-signal
      analysis unless a future implementation explicitly supports it.

## Observability

- [ ] Error logging is enabled in the hosting platform or monitoring provider.
- [ ] Server errors include enough context to debug without logging secrets,
      code payloads, full transcripts, or raw audio.
- [ ] `PATTERNFORGE_FEATURE_ANALYTICS` is enabled or intentionally disabled.
- [ ] Analytics properties contain IDs, counts, statuses, and flags only.
- [ ] Admin analytics is gated by admin role or environment flag.
- [ ] `PATTERNFORGE_FEATURE_BETA_FEEDBACK` is enabled for beta unless feedback is
      intentionally collected elsewhere.
- [ ] Feedback submissions are rate-limited.

## Smoke Test

Run this against the deployed environment after migrations and seed complete:

- [ ] Sign up as a new beta user.
- [ ] Complete onboarding.
- [ ] Take diagnostic.
- [ ] Confirm dashboard shows a starting path and explainable recommendation.
- [ ] Complete a practice attempt.
- [ ] Request an AI review.
- [ ] Complete Daily Review.
- [ ] Start and complete a Boss Battle round.
- [ ] Accept or dismiss a recommendation.
- [ ] Start an interview.
- [ ] Complete interview scoring and open the summary.
- [ ] Open Code Workspace.
- [ ] Save code without running it.
- [ ] Run code only if `CODE_RUNNER_MODE=sandbox` is configured.
- [ ] Use Voice Mode if enabled.
- [ ] Verify voice/text fallback works when microphone or speech provider is
      unavailable.
- [ ] Open Settings.
- [ ] Update preferences.
- [ ] Export user data.
- [ ] Delete voice transcripts if any exist.
- [ ] Submit beta feedback.

## Rollback And Kill Switches

Disable risky features with environment flags and redeploy:

```bash
PATTERNFORGE_FEATURE_AI_COACH="false"
PATTERNFORGE_FEATURE_CODE_RUNNER="false"
PATTERNFORGE_FEATURE_VOICE_MODE="false"
PATTERNFORGE_FEATURE_INTERVIEWS="false"
PATTERNFORGE_FEATURE_BOSS_BATTLES="false"
PATTERNFORGE_FEATURE_RECOMMENDATIONS="false"
PATTERNFORGE_FEATURE_ANALYTICS="false"
PATTERNFORGE_FEATURE_BETA_FEEDBACK="false"
PATTERNFORGE_FEATURE_ADMIN_TOOLS="false"
```

Disable code execution:

```bash
CODE_RUNNER_MODE="disabled"
PATTERNFORGE_FEATURE_CODE_RUNNER="false"
```

Disable AI:

```bash
PATTERNFORGE_FEATURE_AI_COACH="false"
```

Also unset or rotate AI provider keys if there is provider abuse or key
exposure risk.

Disable voice:

```bash
PATTERNFORGE_FEATURE_VOICE_MODE="false"
```

Also unset or rotate speech provider keys if there is provider abuse or key
exposure risk.

If a deployment must be rolled back:

- [ ] Disable risky feature flags first.
- [ ] Roll back application code through the hosting platform.
- [ ] Do not roll back database migrations unless the migration has been
      explicitly reviewed as reversible and data-safe.
- [ ] Keep backups intact until the incident is closed.
- [ ] Record the issue, mitigation, and follow-up before re-enabling the
      affected feature.
