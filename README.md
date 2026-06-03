# PatternForge

PatternForge is a pattern-first coding interview training app. It helps users
practice the work that comes before and around implementation: recognizing the
right pattern, explaining the approach, writing code, testing with custom cases,
reviewing mistakes, and building durable interview readiness over time.

PatternForge stores app-owned learning metadata only. It does not scrape
LeetCode, call the LeetCode API, copy LeetCode problem statements, copy official
examples, or submit anything to LeetCode. Seeded problems include titles,
external links, difficulty, estimated time, recognition clues, common mistakes,
and pattern relationships.

## Version History

### v0.0

- Local-only Next.js prototype.
- Pattern map, pattern detail pages, seeded problem metadata, and Daily Forge.
- Browser-only progress in `localStorage`.
- Practice flow with pattern recognition, reflection, XP, streaks, and mastery.

### v0.1

- Clerk authentication.
- PostgreSQL persistence through Prisma.
- `UserProfile` records mapped to Clerk user IDs.
- Database-backed attempts and dashboard stats.
- Legacy local-progress import for `patternforge_attempts_v0`.

### v0.2

- AI Coach review for saved attempts.
- Server-side AI provider abstraction.
- Database-backed `AIReview`, `Mistake`, and `Flashcard` records.
- AI-generated mistake cards and flashcards from user-provided attempt data.
- Hint Mode with a five-level hint ladder.
- Guardrails for ownership, malformed AI output, input length, and AI review
  limits.

### v0.3

- Spaced repetition for flashcards and mistakes.
- Daily Review queue at `/review`.
- `ReviewLog` history for flashcard and mistake ratings.
- Review completion summary with XP, ratings, reviewed patterns, and
  rescheduled items.
- Mistake Journal at `/mistakes` and flashcards page at `/flashcards`.
- Mastery formula using attempts, AI explanation scores, review retention, and
  confidence.

### v0.4

- Boss Battles at `/battles`.
- Active battle flow and battle summaries.
- Daily quests, achievements, badges, and pattern levels.
- Durable `GameEvent` XP ledger with stable event keys.
- Dashboard widgets for active battles, quests, recent events, achievements,
  and pattern progression.

### v0.5

- Adaptive recommendation engine and Next Best Action dashboard card.
- Database-backed recommendations, pattern insights, pattern confusions,
  learning plans, learning-plan steps, and recommendation feedback.
- Weak-pattern scoring, pattern confusion detection, Adaptive Daily Forge,
  Contrast Drills, Learning Plans, and Readiness Report.
- Recommendation feedback loop for Helpful, Too Easy, Too Hard, Not Relevant,
  and Dismiss.

### v0.6

- Interview Mode at `/interviews`.
- Timed mock sessions for Single Problem, Focused Pattern, Mixed Interview, and
  Weakness Repair interview types.
- Active interview runner at `/interviews/[interviewId]`.
- Interview summary at `/interviews/[interviewId]/summary`.
- Interview history at `/interviews/history`.
- Server-side AI interviewer chat and AI/rule fallback scoring.
- Interview rubric scores, feedback, suggested mistakes, suggested flashcards,
  attempts, AI reviews, XP events, achievements, readiness data, and
  recommendations.
- Global loading, error, and not-found states.

### v0.7

- Code Workspace at `/problems/[problemId]/workspace`.
- Reusable workspace components for practice, interview implementation rounds,
  and boss battle rounds.
- Python-only custom/self-test runner for the MVP.
- Structured runner configs through `ProblemRunnerConfig`, with FreeRun mode
  when a problem does not have structured metadata.
- Custom test case builder with user-owned `TestCase` rows.
- Saved `CodeSubmission`, `CodeRun`, and `TestResult` history.
- Debug Coach that reviews failed custom runs and saves `DebugInsight` rows.
- Code History page at `/code/history`.
- Practice, interview, and battle integrations that link code to attempts,
  interview rounds, and battle rounds.
- Readiness and recommendation signals from code execution.

### v0.8

- Voice Mode for Interview Mode.
- Reusable voice UI components with recording, retry, transcript editing, text
  fallback, skip, and privacy states.
- Transcript-first speech-to-text abstraction under `src/lib/voice`.
- Optional browser speech playback for interviewer prompts.
- Voice session, turn, feedback, and communication insight models.
- AI interviewer prompt context that includes voice transcripts, saved
  interview messages, phase answers, and code run results.
- Communication scoring with clarity, structure, conciseness, transcript-based
  confidence, and technical explanation scores.
- Interview summary voice communication section.
- Private transcript history route at
  `/interviews/[interviewId]/transcript`.
- Lightweight Speaking Practice Drills at `/drills/speaking`.
- Readiness Report communication metrics.
- Voice and speaking recommendations.
- Voice XP events and achievements.

## Voice Mode Behavior

Voice Mode enhances Interview Mode; it does not replace normal text input.
Users can use voice in these phases:

- Clarifying Questions
- Pattern Hypothesis
- Approach
- Implementation, optional narration only
- Testing
- Complexity

Each phase still has the normal text form. If microphone access is unavailable,
recording fails, transcription fails, or the user prefers typing, they can type
the transcript manually and continue. Interview completion is not blocked by
voice availability.

The correct pattern remains hidden until Pattern Hypothesis has been submitted.
Voice transcripts are treated as user-provided text; the app does not infer
tone, emotion, volume, pauses, or vocal confidence from audio.

## Transcript Storage Behavior

PatternForge v0.8 is transcript-first.

- Saved spoken turns are stored as `VoiceTurn` rows.
- Raw audio is not stored by default.
- `audioUrl` is optional and currently not required by the v0.8 flow.
- Users can edit transcripts before saving.
- Users can skip voice for any phase.
- Users can abandon a voice session.
- Users can delete saved voice transcripts and transcript-derived feedback for
  an interview.

Privacy copy shown in the app:

> Voice Mode stores transcripts so PatternForge can give communication feedback.
> Audio storage is optional and disabled by default.

## Communication Scoring Rubric

Communication scoring lives in `src/lib/ai/scoreCommunication.ts` and uses
transcripts plus saved interview evidence. Scores are 1-100.

- Clarity: Was the explanation understandable?
- Structure: Did the user organize the approach before details?
- Conciseness: Did the user avoid unnecessary rambling?
- Confidence: Did the transcript wording sound decisive? This is based only on
  words in the transcript, not actual vocal tone.
- Technical Explanation: Did the user explain the pattern, invariant, data
  structures, tests, and complexity?

Communication insights include:

- `UnclearApproach`
- `MissingInvariant`
- `TooVerbose`
- `TooQuietOrUncertain`
- `StrongExplanation`
- `WeakTestingExplanation`
- `WeakComplexityExplanation`
- `GoodTradeoffDiscussion`

If transcript evidence is sparse, scoring should say that confidence in the
communication score is limited.

## Speaking Drills

Speaking Practice Drills are available at `/drills/speaking`.

Drill types:

- Explain a Pattern
- Explain an Approach
- Explain a Debugging Failure
- Explain Complexity

The drill flow is prompt, record or type answer, transcribe, score, show
communication feedback, suggest improvement, and optionally create a flashcard
or mistake. Speaking drills reuse the same voice controls and communication
scoring rubric as Interview Mode.

## XP and Achievements

v0.8 adds these `GameEventType` values:

- `VoiceInterviewCompleted`
- `SpeakingDrillCompleted`
- `CommunicationInsightCreated`

Voice XP rules:

- +30 for completing a voice interview.
- +15 for completing a speaking drill.
- +20 for clarity score >= 80.
- +20 for structure score >= 80.
- +20 for technical explanation score >= 80.
- +10 for using voice in all major interview phases.

Duplicate XP is prevented through stable `GameEvent.eventKey` values based on
source metadata such as `voiceSessionId`, `speakingDrillId`, and
`communicationInsightId`.

v0.8 achievements:

- First Spoken Forge: complete first voice interview.
- Clear Explainer: clarity score >= 85.
- Structured Thinker: structure score >= 85.
- Pattern Narrator: technical explanation score >= 85.
- Complexity Speaker: complete 5 complexity narration drills.

## Privacy Notes

- Voice transcripts are private to the authenticated user.
- Users can only access their own voice sessions, turns, feedback, and
  communication insights.
- Transcript history is not public.
- Transcripts are not used for social features.
- Raw audio storage is off by default.
- No provider API keys are exposed to the browser.
- AI and speech provider calls that require secrets must stay server-side.
- Browser speech playback may be used for local interviewer text playback and
  does not require a provider key.

## Environment Variables

Create `.env` from `.env.example`.

Required:

```bash
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

Optional AI provider settings:

```bash
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.example.com/v1"
AI_API_KEY="replace_with_server_side_key"
AI_MODEL="replace_with_model_name"
```

Optional speech settings:

```bash
SPEECH_PROVIDER="mock"
```

Supported v0.8 speech provider modes are `mock` and `local`. Both are
development-safe and keep raw audio storage optional.

## Database Setup

PatternForge uses Prisma with PostgreSQL.

1. Start PostgreSQL.
2. Set `DATABASE_URL`.
3. Install dependencies.
4. Apply migrations.
5. Seed the database.

Commands:

```bash
npm install
npx prisma migrate dev
npm run db:seed
```

## Migrations

Prisma migrations live under `prisma/migrations`.

Important v0.8 migrations:

- `20260603000000_add_voice_mode`
- `20260603010000_add_voice_recommendation_types`
- `20260603013000_add_voice_game_events`

Validate the schema:

```bash
npx prisma validate
```

Check migration status against a reachable database:

```bash
npx prisma migrate status
```

Generate Prisma client:

```bash
npx prisma generate
```

## Seed Command

```bash
npm run db:seed
```

Seed data includes PatternForge-owned metadata only: titles, external links,
difficulty, recognition clues, common mistakes, pattern relationships, runner
configs, and achievements. It does not seed copied problem statements or
official examples.

## Run Locally

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open `http://localhost:3000`.

Useful checks:

```bash
npm test
npm run lint
npm run build
npx prisma validate
```

## How To Test Voice Mode

1. Sign in.
2. Start an interview at `/interviews`.
3. Work through Clarifying Questions, Pattern Hypothesis, Approach, Testing,
   and Complexity.
4. Use Voice Mode in one or more phases.
5. Confirm the transcript appears and can be edited.
6. Submit the transcript, then continue the phase.
7. Complete the interview.
8. Open the summary page and verify the Voice Communication section.
9. Open `/interviews/[interviewId]/transcript`.
10. Confirm transcript filtering, copy, collapse/expand, feedback highlights,
    and deletion controls.

Fallback checks:

- Deny microphone permission and type manually.
- Use "Skip voice for this phase" and continue with normal text input.
- Complete a normal text-only interview and confirm Voice Mode does not block
  completion.
- Use `/drills/speaking` and submit a typed transcript.

## What Is Intentionally Excluded

- Video simulation.
- Social features.
- Leaderboards.
- Official LeetCode submissions.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Copied official LeetCode examples.
- Official LeetCode execution or acceptance claims.
- Raw audio storage by default.
- Public transcript sharing.
- Audio-based tone or emotion analysis.

## Reliability Checklist

Before shipping a v0.8 branch:

```bash
npm test
npm run lint
npm run build
npx prisma validate
npx prisma migrate status
```

Also manually verify:

- Authenticated users can access only their own interview, voice, transcript,
  feedback, recommendation, and code-workspace data.
- AI review, daily review, boss battles, recommendations, interviews, and code
  workspace still work.
- Voice controls have loading, error, empty, unavailable, permission, recording,
  processing, ready, failed, saved, and text fallback states.
- Communication feedback does not claim to hear tone or emotion.
- No client component imports server-only AI provider code.

## Roadmap

### v0.9: Production Hardening, Onboarding, Analytics

- Production onboarding for first-time users.
- Better empty-state guided setup.
- Operational analytics for activation, retention, review completion, interview
  completion, code-run health, and voice-mode adoption.
- More robust database migration and deployment playbooks.
- Error monitoring and structured logs.
- Rate limits and usage controls for AI and speech features.
- Stronger data export/delete flows.
- Broader automated coverage for server actions and critical user journeys.

### v1.0: Full Learning System

- Cohesive end-to-end learning loop across practice, review, interviews, code,
  debugging, speaking, readiness, and recommendations.
- Stable curriculum paths from beginner to interview-ready.
- Production-grade personalization and mastery modeling.
- Complete user controls for learning data and privacy.
- Polished onboarding, guidance, and progress narrative.
- Hardened release process and deployment posture.

## v0.8 Summary

v0.8 adds transcript-first Voice Mode, spoken mock interview practice,
communication scoring, transcript history, speaking drills, readiness metrics,
voice-aware recommendations, XP events, and achievements. Voice Mode is optional
and does not block normal Interview Mode.

## How To Test This Release

Run:

```bash
npm test
npm run lint
npm run build
npx prisma validate
npx prisma migrate status
```

Then manually test:

- Normal text-only interview.
- Voice interview with transcripts.
- Failed transcription with manual fallback.
- Speaking drill with typed transcript.
- Interview summary voice section.
- Transcript history and deletion.
- Readiness report communication metrics.
- Dashboard recent voice game events.
- Voice achievements after qualifying practice.

## Known Limitations

- Speech-to-text is provider-agnostic but currently configured for mock/local
  development modes.
- Browser interviewer playback uses the Web Speech API when available.
- Raw audio storage is intentionally not implemented by default.
- Code execution is Python-only and uses PatternForge custom tests, not
  official judge results.
- Migration status requires a reachable PostgreSQL database.
- Automated tests are mostly type/lint/build plus focused unit tests; more
  route-level and server-action tests should be added before production.

## Recommended v0.9 Scope

Focus v0.9 on production hardening: onboarding, analytics, migration/deployment
runbooks, stronger automated test coverage, monitoring, rate limits, data
controls, and smoother first-run states. Avoid expanding product surface until
the v0.8 learning loops are reliable in production-like usage.
