# PatternForge

PatternForge helps you recognize, remember, and master coding interview
patterns.

It is a pattern-first interview training app built with Next.js, TypeScript,
Tailwind, Clerk authentication, Prisma, and PostgreSQL. PatternForge focuses on
the learning loop around coding interviews: recognizing the pattern, explaining
the approach, practicing implementation, reviewing mistakes, pressure-testing
with battles and mock interviews, and tracking readiness over time.

PatternForge stores app-owned learning metadata only. It does not scrape
LeetCode, call the LeetCode API, copy LeetCode problem statements, copy official
examples, copy official constraints, submit to LeetCode, or claim official
LeetCode judge results.

## Version History

### v0.0

- Local-only Next.js prototype.
- Seeded pattern map, pattern detail pages, Daily Forge, and practice flow.
- Browser-only progress through `localStorage`.
- Pattern recognition, reflection, XP, streaks, and mastery scoring.

### v0.1

- Clerk authentication.
- PostgreSQL persistence through Prisma.
- `UserProfile` records mapped to authenticated users.
- Database-backed attempts and dashboard stats.
- Legacy local-progress import for `patternforge_attempts_v0`.

### v0.2

- AI Coach review for saved attempts.
- Server-side AI provider abstraction.
- Database-backed `AIReview`, `Mistake`, and `Flashcard` records.
- AI-generated mistake cards and flashcards from user-provided attempt context.
- Hint Mode with a five-level hint ladder.
- Ownership checks, malformed-output handling, input-size limits, and safe
  fallback behavior.

### v0.3

- Spaced repetition for flashcards and mistakes.
- Daily Review queue at `/review`.
- `ReviewLog` history and review completion summaries.
- Mistake Journal at `/mistakes` and flashcards page at `/flashcards`.
- Mastery scoring from attempts, AI explanation scores, retention, and
  confidence.

### v0.4

- Boss Battles at `/battles`.
- Active battle flow and battle summaries.
- Daily quests, achievements, badges, pattern levels, and XP rewards.
- Durable `GameEvent` ledger with stable event keys.
- Dashboard widgets for battles, quests, recent events, achievements, and
  pattern progression.

### v0.5

- Adaptive recommendation engine and Next Best Action dashboard card.
- Database-backed recommendations, pattern insights, pattern confusions,
  learning plans, learning-plan steps, and recommendation feedback.
- Adaptive Daily Forge, Contrast Drills, Learning Plans, and Readiness Report.
- Feedback loop for Helpful, Too Easy, Too Hard, Not Relevant, and Dismiss.

### v0.6

- Interview Mode at `/interviews`.
- Single Problem, Focused Pattern, Mixed Interview, and Weakness Repair mocks.
- Active interview runner at `/interviews/[interviewId]`.
- Interview summary at `/interviews/[interviewId]/summary`.
- Interview history at `/interviews/history`.
- Server-side AI interviewer chat and AI/rule fallback scoring.
- Interview rubric scores, feedback, suggested mistakes, suggested flashcards,
  attempts, AI reviews, XP events, achievements, readiness data, and
  recommendations.

### v0.7

- Code Workspace at `/problems/[problemId]/workspace`.
- Reusable workspace for practice, interview rounds, and boss battle rounds.
- Python-only custom/self-test runner for development and sandboxed production.
- Structured runner configs through `ProblemRunnerConfig`.
- User-owned custom `TestCase` rows.
- Saved `CodeSubmission`, `CodeRun`, and `TestResult` history.
- Debug Coach for failed custom runs and saved `DebugInsight` rows.
- Code History page at `/code/history`.
- Code execution signals in readiness and recommendations.

### v0.8

- Voice Mode for Interview Mode.
- Reusable voice UI with recording, retry, transcript editing, text fallback,
  skip, and privacy states.
- Transcript-first speech-to-text abstraction under `src/lib/voice`.
- Optional browser speech playback for interviewer prompts.
- `VoiceSession`, `VoiceTurn`, `VoiceFeedback`, and communication insight
  models.
- Communication scoring for clarity, structure, conciseness, transcript-based
  confidence, and technical explanation.
- Private transcript history at `/interviews/[interviewId]/transcript`.
- Speaking drills at `/drills/speaking`.
- Voice-aware readiness metrics, recommendations, XP events, and achievements.

### v0.9

- First-time onboarding at `/onboarding`.
- Lightweight diagnostic at `/onboarding/diagnostic`.
- Personalized seven-day starting plan after onboarding or diagnostic.
- User settings and privacy controls at `/settings`.
- Data export at `/api/settings/export`.
- Voice transcript, code submission, AI review, and learning-progress deletion
  controls with typed confirmations.
- Privacy-conscious product analytics through `AnalyticsEvent`.
- Beta feedback widget and `UserFeedback` model.
- Feature flags for risky beta surfaces.
- Rate limits for AI, speech, code execution, and feedback.
- AI route hardening helpers for input size, safe JSON parsing, redaction, and
  prompt context construction.
- Code runner production hardening with `CODE_RUNNER_MODE`.
- Expanded metadata-only problem bank with 108 problems across 12 patterns.
- Seed data validation script.
- Focused unit, integration, code-runner, and data validation test commands.
- Performance pass: dashboard payload bounds, paginated code/transcript/admin
  lists, narrower Prisma selects, and additive performance indexes.
- Deployment checklist at `docs/DEPLOYMENT.md`.

## Onboarding Behavior

The onboarding flow is available at `/onboarding` and requires authentication.
It asks for:

- Primary preparation goal.
- LeetCode-style experience level.
- Daily practice time.
- Preferred language, currently Python.
- Voice Mode preference.
- Whether to take the diagnostic or start with a beginner plan.

On finish, PatternForge creates or updates:

- `UserSettings`
- `UserGoal`
- `OnboardingState`
- Optional `DiagnosticAssessment`
- A personalized starting `LearningPlan`

Users who have completed onboarding are not forced through it again. Users who
skip onboarding are marked `Skipped` and can still use the app.

## Diagnostic Behavior

The diagnostic is intentionally lightweight for v0.9. It uses seeded
PatternForge metadata only and does not show full problem statements.

It asks:

- Pattern-recognition questions using title, difficulty, and recognition clues.
- A 1-5 confidence check.
- A pattern experience check.

On completion, it saves `DiagnosticAssessment` and `DiagnosticQuestion` rows,
estimates the user level, recommends a start pattern, updates
`UserSettings.currentLevel`, creates or refreshes the starting plan, and routes
to the diagnostic result page.

## Starting Plan Behavior

PatternForge creates a seven-day starting path from onboarding preferences and
diagnostic signals:

- Beginner: Arrays & Hashing, then Two Pointers and Sliding Window.
- Some Experience: diagnostic weak pattern, review warmups, and contrast drills
  when confusion is detected.
- Interview Prep: weakest high-value pattern, Daily Forge, review, and later
  Interview Mode.
- Advanced: mixed practice, Boss Battle, or mock interview after baseline
  diagnostic.

The dashboard shows the starting path, today's step, and why the plan was
chosen.

## Analytics And Privacy

Analytics are server-side where possible and are used for internal product
quality only.

Tracked events include onboarding, diagnostic, Daily Forge, attempts, AI review,
Daily Review, battles, interviews, code runs, voice turns, recommendations, and
feedback.

Analytics properties are sanitized before storage:

- Allowed: IDs, counts, statuses, booleans, numeric scores, and short enum-like
  strings.
- Blocked: code, transcripts, prompts, answers, messages, reflections, stdout,
  stderr, raw content, and other sensitive text fields.

Users can opt out through Settings. Voice transcripts are private to the
authenticated user. Raw audio storage is disabled by default.

## Feature Flags

Feature flags live under `src/lib/feature-flags` and are controlled by
environment variables:

```bash
PATTERNFORGE_FEATURE_AI_COACH="true"
PATTERNFORGE_FEATURE_CODE_RUNNER="true"
PATTERNFORGE_FEATURE_VOICE_MODE="true"
PATTERNFORGE_FEATURE_INTERVIEWS="true"
PATTERNFORGE_FEATURE_BOSS_BATTLES="true"
PATTERNFORGE_FEATURE_RECOMMENDATIONS="true"
PATTERNFORGE_FEATURE_ANALYTICS="true"
PATTERNFORGE_FEATURE_BETA_FEEDBACK="true"
PATTERNFORGE_FEATURE_ADMIN_TOOLS="false"
```

Accepted values include `true/false`, `1/0`, `yes/no`, `on/off`, and
`enabled/disabled`. Disabled features should show clean unavailable states
without breaking navigation.

## Rate Limits

Rate limiting lives under `src/lib/rate-limit`. Limits are in-memory for v0.9
and configurable by environment variable:

```bash
PATTERNFORGE_RATE_LIMIT_AI_REVIEWS_PER_DAY="20"
PATTERNFORGE_RATE_LIMIT_HINTS_PER_DAY="50"
PATTERNFORGE_RATE_LIMIT_DEBUG_COACH_PER_DAY="30"
PATTERNFORGE_RATE_LIMIT_AI_INTERVIEWER_PER_DAY="80"
PATTERNFORGE_RATE_LIMIT_INTERVIEW_SCORING_PER_DAY="20"
PATTERNFORGE_RATE_LIMIT_COMMUNICATION_SCORING_PER_DAY="40"
PATTERNFORGE_RATE_LIMIT_VOICE_TRANSCRIPTIONS_PER_DAY="60"
PATTERNFORGE_RATE_LIMIT_TEXT_TO_SPEECH_PER_DAY="200"
PATTERNFORGE_RATE_LIMIT_CODE_RUNS_PER_DAY="100"
PATTERNFORGE_RATE_LIMIT_FEEDBACK_PER_DAY="10"
```

Set a limit to `0` to temporarily disable that action.

## Code Runner Production Notes

`CODE_RUNNER_MODE` accepts:

- `disabled`
- `local-dev`
- `sandbox`

Production should use `disabled` or `sandbox`.

```bash
CODE_RUNNER_MODE="disabled"
CODE_RUNNER_SANDBOX_URL=""
CODE_RUNNER_SANDBOX_TOKEN=""
```

`local-dev` runs Python locally and is development-only. In production, local
execution is blocked. If `sandbox` is selected without a configured sandbox
provider, PatternForge disables execution and keeps code editing/saving
available.

The sandbox contract requires:

- No network access.
- No secret access.
- No persistent filesystem access.
- No arbitrary shell access from user input.
- Strict timeouts.
- Strict output limits.
- Strict input limits.
- Safe error messages.

PatternForge does not provide official LeetCode judging.

## Environment Variables

Required:

```bash
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

Optional app metadata:

```bash
NEXT_PUBLIC_PATTERNFORGE_VERSION="0.9.0"
PATTERNFORGE_VERSION="0.9.0"
```

Optional AI provider settings:

```bash
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.example.com/v1"
AI_API_KEY="replace_with_server_side_key"
AI_MODEL="replace_with_model_name"
```

`OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` are also supported by
the provider abstraction. Keep all AI keys server-side.

Optional AI size control:

```bash
PATTERNFORGE_AI_MAX_PROMPT_CHARS="20000"
```

Optional speech settings:

```bash
SPEECH_PROVIDER="mock"
```

Supported v0.9 speech provider modes are provider-agnostic; the default mock
mode is safe for local development.

## Database Setup

PatternForge uses Prisma with PostgreSQL.

1. Start PostgreSQL.
2. Set `DATABASE_URL`.
3. Install dependencies.
4. Apply migrations.
5. Seed PatternForge metadata.

Local setup:

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Production migration:

```bash
npx prisma migrate deploy
```

## Migrations

Prisma migrations live under `prisma/migrations`.

Useful commands:

```bash
npx prisma validate
npx prisma migrate status
npx prisma generate
```

The v0.9 migration set includes onboarding/preferences, analytics/privacy,
feedback, and performance indexes.

## Seed Command

```bash
npm run db:seed
```

Seed data includes PatternForge-owned metadata only: pattern descriptions,
recognition clues, common mistakes, problem titles, external LeetCode links,
difficulty, estimated minutes, pattern relationships, runner configs, and
achievements.

Validate seed source data without a database:

```bash
npm run validate:data
```

## Testing Commands

Default safe test suite:

```bash
npm test
```

Other checks:

```bash
npm run typecheck
npm run lint
npm run build
npx prisma validate
npm run validate:data
npm run test:integration
npm run test:code-runner
```

Database integration tests are opt-in:

```bash
npm run test:integration:db
```

`test:code-runner` intentionally uses `CODE_RUNNER_MODE=local-dev` under
`NODE_ENV=test`; do not use local-dev runner mode in production.

## Deployment Checklist

Use `docs/DEPLOYMENT.md` before opening v0.9 to beta users. It covers:

- Environment variables.
- Database migrations, seed, indexes, and backups.
- Security checks.
- AI and voice provider checks.
- Observability, analytics, and feedback.
- Smoke testing.
- Rollback and kill switches.

## Performance Notes

v0.9 keeps beta-user pages bounded as usage grows:

- Dashboard progress computes server-side mastery and XP from saved activity,
  but sends only a recent attempt slice to the browser.
- Code history, transcript history, and admin analytics are paginated.
- Review queues and interview summaries use narrower Prisma selects.
- Analytics trend rendering samples recent event rows defensively.
- Additive performance indexes support user/time history, due reviews,
  recommendations, code runs, voice turns, analytics, and feedback.

Before increasing page sizes or adding dashboard widgets, profile against
production-like row counts.

## Security And Ownership

Authenticated user data is scoped through `ensureCurrentUserProfile()` and
`userProfileId` filters. Protected areas include attempts, AI reviews, mistakes,
flashcards, reviews, battles, recommendations, interviews, code submissions,
code runs, voice sessions, transcripts, feedback, settings, exports, and
destructive controls.

API keys remain server-side. The only `NEXT_PUBLIC_` values are public app
configuration, such as the Clerk publishable key and optional app version.

## Loading, Error, And Empty States

v0.9 includes loading states for slow server-rendered pages such as dashboard
data, pattern map, review, readiness, code history, admin analytics, interview
summary, and transcript history. Feature-flagged or unavailable surfaces use
clean disabled/unavailable states. New-user dashboard states point users toward
onboarding, diagnostic, Daily Forge, review, and starting plan actions.

## What Is Intentionally Excluded

- Social features.
- Leaderboards.
- Paid subscriptions.
- Mobile app.
- Official LeetCode submissions.
- LeetCode scraping.
- LeetCode API usage.
- Copied LeetCode problem statements.
- Copied official examples.
- Copied official constraints.
- Official LeetCode judging or acceptance claims.
- Public transcript sharing.
- Raw audio storage by default.
- Audio-based tone or emotion analysis.

## v0.9 Release Summary

### What Changed In v0.9

PatternForge v0.9 prepares the app for real beta users. It adds onboarding,
diagnostic assessment, user preferences, personalized starting plans,
settings/privacy controls, data export, destructive data controls, product
analytics, feedback collection, feature flags, rate limits, AI safety helpers,
code runner production gating, a larger legal-safe metadata bank, more tests,
performance indexes, pagination, loading states, deployment documentation, and
production-readiness verification.

### How To Test It

Run:

```bash
npm test
npm run test:integration
npm run test:code-runner
npm run lint
npm run validate:data
npx prisma validate
npm run build
```

With a reachable PostgreSQL database, also run:

```bash
npx prisma migrate deploy
npm run db:seed
npx prisma migrate status
```

Manual smoke test:

- Sign up.
- Complete onboarding.
- Complete diagnostic.
- Confirm starting path on dashboard.
- Complete first attempt.
- Request AI review.
- Complete Daily Review.
- Start and complete a Boss Battle round.
- Accept or dismiss a recommendation.
- Start and complete an interview.
- Open interview summary.
- Open Code Workspace and save code.
- Run code only when sandbox mode is configured.
- Use Voice Mode or text fallback.
- Open Settings and export data.
- Confirm dangerous controls require typed confirmation.
- Submit beta feedback.

### Known Limitations

- Rate limits are in-memory for v0.9 and should move to durable storage before
  multi-instance production scale.
- Full account deletion is a manual support placeholder.
- Speech provider integration is provider-agnostic and defaults to mock/local
  behavior unless configured.
- Raw audio storage is intentionally disabled by default.
- Code execution is Python-only and requires a production sandbox for beta.
- Admin analytics is intentionally simple and should use rollups or dedicated
  reporting before high event volume.
- E2E tests are not yet configured; current automated coverage is unit,
  opt-in DB integration, code-runner, data validation, typecheck, lint, and
  build.

### Recommended v1.0 Scope

v1.0 should focus on a beta-ready full learning system:

- Harden multi-instance rate limiting and analytics storage.
- Add E2E coverage for onboarding, diagnostic, attempt, review, battle,
  interview, code workspace, voice fallback, settings, export, and feedback.
- Add production monitoring, alerting, and error triage workflows.
- Finish audited full account deletion.
- Improve learning-plan iteration based on real beta telemetry.
- Add deeper readiness calibration from real usage signals.
- Polish first-session, empty-state, and recovery flows based on beta feedback.
- Keep avoiding social, leaderboards, subscriptions, mobile app, LeetCode
  scraping, official submissions, and copied content until the core learning
  loop is stable.
