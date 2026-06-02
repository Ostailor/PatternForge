# PatternForge

PatternForge is a pattern-first coding interview training app. It helps users
practice the skill that usually comes before implementation: recognizing the
underlying pattern, choosing an approach, solving from an official external
problem link, reflecting on the attempt, and repairing weak spots over time.

PatternForge stores app-owned learning metadata only. It does not scrape
LeetCode, call the LeetCode API, copy LeetCode problem statements, or submit
anything to LeetCode. Seeded problems include titles, official links,
difficulty, estimated time, recognition clues, common mistakes, and pattern
relationships.

## Version Summary

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
- Guardrails for ownership, malformed AI output, input length, and daily AI
  review limits.

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

## Interview Mode Behavior

Interview sessions are authenticated, private, database-backed mock interviews.
Users open the external problem link themselves and work through structured
phases:

1. `Setup`: see problem metadata and the external link. The correct pattern is
   not shown.
2. `ClarifyingQuestions`: save assumptions and questions.
3. `PatternHypothesis`: select a likely pattern and explain the signal.
4. `Approach`: describe the plan, data structures, and invariant.
5. `Implementation`: paste code or implementation notes.
6. `Testing`: write test cases and edge cases.
7. `Complexity`: state time and space complexity plus self-reported solve
   status, time spent, and confidence.
8. `Feedback`: save final scoring, rubric, feedback, artifacts, and rewards.

Interview rounds create normal `Attempt` rows when a round reaches feedback, so
existing mastery, recommendations, readiness, mistakes, flashcards, and XP
systems can learn from interview practice. Refreshes do not double-create
attempts after a round has an `attemptId`, and stable `GameEvent` keys prevent
duplicate XP awards for the same interview.

## AI Interviewer Behavior

AI interviewer calls happen server-side only through `src/lib/ai/client.ts`.
API keys are read from unprefixed server environment variables and are never
exposed to client components.

The interviewer:

- Acts like a realistic but fair technical interviewer.
- Asks clarifying follow-up questions.
- Encourages reasoning, tradeoffs, edge cases, and complexity discussion.
- Gives staged hints only when the user asks or says they are stuck.
- Uses the correct pattern internally, but does not reveal it before Pattern
  Hypothesis is submitted.
- Uses only PatternForge metadata and user-provided text/code.
- Never copies, reconstructs, summarizes, or invents LeetCode statements.
- Does not claim code passed tests unless execution evidence is supplied by the
  user. PatternForge v0.6 does not execute code.
- Falls back to deterministic interviewer prompts when the AI provider is
  unavailable or returns malformed JSON.

## Interview Scoring Rubric

Interview scoring returns an overall score from 1 to 100, result label, summary,
strengths, weaknesses, missed signals, recommendations, suggested mistakes, and
suggested flashcards.

Rubric categories:

- Communication: clarity, structure, and response to prompts.
- Pattern Recognition: correct pattern choice and explanation.
- Problem Solving: approach quality, invariant, and data structure reasoning.
- Implementation: likely correctness from code or plan. Confidence is limited
  when code is missing or tests were not run.
- Testing: meaningful examples and edge cases.
- Complexity: correct time and space analysis.
- Time Management: reasonable phase pacing.

Results:

- `StrongHire`
- `Hire`
- `LeanHire`
- `LeanNoHire`
- `NoHire`

## Recommendation Engine Behavior

Recommendations are generated server-side for the current `UserProfile`.
Priority remains:

1. Critical due reviews.
2. Active battle or interview resume.
3. Severe weakness.
4. Interview readiness action.
5. General Daily Forge and lower-priority follow-ups.

v0.6 adds interview recommendation types:

- `MockInterview`
- `FocusedInterview`
- `WeaknessRepairInterview`

The engine recommends interviews when readiness is high but no interviews are
completed, weak patterns have enough practice history, multiple patterns have
decent mastery, a recent boss battle failed, interview scores show explanation
gaps, or interview practice is stale. Interview recommendations are not allowed
to crowd out overdue review recommendations.

## Readiness Report

The Readiness Report at `/readiness` is a training-readiness estimate, not a
guarantee of interview success.

v0.6 readiness includes:

- Interview Performance.
- Rubric Breakdown.
- Interview Weak Spots.
- Recommended Next Mock.

Overall readiness now weighs pattern coverage, recognition, solve consistency,
retention, boss battle performance, interview performance, mistake recovery,
and confidence. Users with no interviews are shown a first-mock CTA without a
harsh penalty.

## XP and Achievements

Interview XP uses the `GameEvent` ledger:

- +40 for completing a mock interview.
- +20 for completing all phases.
- +25 for correct pattern recognition during the interview.
- +25 for score >= 70.
- +50 for score >= 85.
- +15 for meaningful test cases.
- +15 for correct complexity explanation.

Interview achievements:

- First Mock.
- Clear Communicator.
- Complexity Clean.
- Edge Case Hunter.
- Interview Ready.
- Comeback Candidate.

Achievements are awarded once through the existing `UserAchievement` uniqueness
constraint and achievement `GameEvent` keys.

## Environment Variables

Required:

```text
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

Optional AI variables:

```text
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.example.com/v1"
AI_API_KEY="replace_with_server_side_key"
AI_MODEL="replace_with_model_name"
```

The AI client also accepts `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
`OPENAI_MODEL` as fallbacks. Keep AI keys server-side only. Do not prefix AI
keys with `NEXT_PUBLIC_`.

## Database Setup

Start PostgreSQL. One Docker option:

```bash
docker run --name patternforge-db \
  -e POSTGRES_USER=patternforge \
  -e POSTGRES_PASSWORD=patternforge \
  -e POSTGRES_DB=patternforge \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Install dependencies and generate Prisma Client:

```bash
npm install
npm run prisma:generate
```

## Migrations

Apply local migrations:

```bash
npm run prisma:migrate
```

Apply migrations in deploy-style environments:

```bash
npx prisma migrate deploy
```

Check migration status:

```bash
npx prisma migrate status
```

Validate the Prisma schema:

```bash
npx prisma validate
```

The v0.1-v0.6 migrations are additive. They add auth-backed progress, AI Coach,
review scheduling, battles, recommendations, learning plans, contrast drills,
interviews, interview rewards, and interview recommendations without deleting
existing app data.

## Seed Command

Seed patterns, problems, problem-pattern relationships, and achievements:

```bash
npm run db:seed
```

The seed is idempotent. Seeded problem records include titles, official links,
difficulty, estimated time, recognition clues, common mistakes, and pattern
relationships. They do not include copied problem statements.

## Run Locally

```bash
npm install
npm run prisma:generate
npm run prisma:migrate
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). If port 3000 is occupied,
run `npm run dev -- -p 3100` or another open port.

## How To Test Interview Mode

1. Configure Clerk, PostgreSQL, and optional AI server variables.
2. Run migrations and seed data.
3. Sign in.
4. Open `/interviews`.
5. Start a Single Problem Interview and confirm only problem metadata and the
   external link are shown.
6. Submit each phase and refresh after each step to confirm progress resumes.
7. Confirm Pattern Hypothesis does not reveal the correct pattern before
   submission.
8. Complete Complexity with self-reported solve status, time spent, and
   confidence.
9. Confirm the round creates one `Attempt` and the `InterviewRound.attemptId`
   is set.
10. Confirm feedback, rubric scores, suggested mistakes, and suggested
    flashcards are saved.
11. Open the summary page and verify score, result, XP, rubric cards, mistakes,
    flashcards, and round breakdown.
12. Open `/interviews/history` and verify filters plus Resume/View Summary CTAs.
13. Open `/readiness` and verify Interview Performance, Rubric Breakdown, Weak
    Spots, and Recommended Next Mock.
14. Open the dashboard and confirm recent interview game events and interview
    recommendations appear without hiding due reviews.
15. Try another user's interview ID while signed in as a different user and
    confirm the page returns not found.

## Verification Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Run the unit-style local test suite:

```bash
node --import tsx --test $(rg --files -g '*.test.ts' src | rg -v 'integration' | sort)
```

Run the AI review persistence integration test only against a disposable or
known-safe database:

```bash
node --import tsx --test src/lib/ai-review-db.integration.test.ts
```

That integration test now cleans up only its dedicated test users, but it still
requires valid `DATABASE_URL` credentials and seeded problem/pattern data.

## Intentionally Excluded

PatternForge v0.6 intentionally excludes:

- Live voice mode.
- Video simulation.
- Social features.
- Leaderboards.
- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Automatic submission to LeetCode.
- Code execution sandbox.
- Claims that code passed tests unless tests were actually executed outside the
  app and supplied by the user.
- Payments or subscriptions.
- Public sharing of private progress.

## Known Limitations

- v0.6 does not execute code.
- AI scoring is feedback, not a guarantee of correctness or hiring outcome.
- Live AI requires server-side AI provider credentials. Without them,
  deterministic fallback interviewer and scoring logic is used.
- Local migration and DB integration checks require a valid PostgreSQL user,
  password, and database in `DATABASE_URL`.
- Clerk development keys produce local browser warnings. Production deployments
  should use production Clerk keys.

## Roadmap

### v0.7 Voice Mode or Code Execution Sandbox

- Option A: voice-mode interview practice with transcript persistence, staged
  hints, and communication scoring.
- Option B: code execution sandbox for supported languages, real test execution,
  safer implementation scoring, and explicit pass/fail evidence.

Recommended v0.7 scope: prioritize the code execution sandbox if scoring
accuracy is the highest product risk; prioritize voice mode if communication
practice is the highest user value.

### v1.0 Full Learning System

- End-to-end adaptive curriculum.
- More durable long-term mastery and retention analytics.
- Richer review tuning from user feedback.
- Stronger personalized pacing across patterns, battles, reviews, plans, and
  interviews.
- Production hardening for observability, rate limits, operational support, and
  evaluation of AI outputs.

## Current v0.6 Summary

v0.6 adds Interview Mode, timed mock sessions, AI interviewer prompts,
interview scoring, feedback persistence, interview-derived attempts, interview
history, readiness/reporting integration, interview recommendations, XP events,
and interview achievements.

To test it, configure auth and database credentials, run migrations and seed,
sign in, complete a mock interview through every phase, then verify summary,
history, readiness, dashboard events, recommendations, attempts, feedback,
mistakes, flashcards, XP, and achievements.
