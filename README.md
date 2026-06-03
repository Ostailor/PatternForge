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
- Readiness and recommendation signals from code execution: self-test pass
  rate, runtime stability, testing discipline, repeated runtime errors, and
  failed custom tests.

## Code Workspace Behavior

The Code Workspace lets signed-in users write Python code for a PatternForge
problem, create custom tests, run server-side custom tests, save code, inspect
stdout/stderr/errors, and view previous submissions. Users who are not signed in
can preview and type locally, but saving code, running code, storing tests, and
using Debug Coach require authentication.

Workspace context is optional but preserved when present:

- Practice work can link to an `Attempt`.
- Interview work can link to an `InterviewRound`.
- Battle work can link to a `BattleRound`.

The workspace shows the problem title, difficulty, official external link,
current mode, editor, custom test builder, run results, submission history, and
Debug Coach entry point after failed runs. It never displays copied problem
statements or official examples.

## Custom Test Runner Behavior

PatternForge v0.7 starts with Python only. Structured mode calls a configured
function using JSON test inputs and compares JSON-serializable output with the
expected output. Unsupported languages, oversized code, oversized test payloads,
unsupported run types, and too many tests are rejected before execution.

When a problem has no runner config, the workspace switches to FreeRun mode and
shows: "Structured tests are not configured for this problem yet. You can still
run free-form Python code." FreeRun executes a full Python script and captures
stdout, stderr, runtime, and errors without test assertions.

All result copy uses PatternForge custom/self-test language. Passing custom
tests is not an official correctness result and is not a LeetCode acceptance
claim.

## Debug Coach Behavior

Debug Coach is available after failed custom runs, runtime errors, timeouts, or
validation failures. It receives only PatternForge metadata, user-provided code,
custom tests, stdout, stderr, runtime errors, and available attempt reflection.
It saves a `DebugInsight` with summary, likely cause, suggested fix, and an
optional follow-up question.

Debug Coach does not scrape LeetCode, does not fetch official solutions, does
not reveal hidden pattern information before the flow has revealed it, and does
not claim code passes official tests.

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
- Describes code execution only as PatternForge custom tests or self-tests when
  server-side execution evidence exists.
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

v0.7 adds code-execution recommendation types:

- `DebugDrill`
- `TestingPractice`
- `ImplementationPractice`

The engine recommends interviews when readiness is high but no interviews are
completed, weak patterns have enough practice history, multiple patterns have
decent mastery, a recent boss battle failed, interview scores show explanation
gaps, or interview practice is stale. It recommends debugging/testing/
implementation practice when code runs show repeated runtime errors, low custom
test count, or strong recognition with failed custom tests. Interview and
execution recommendations are not allowed to crowd out overdue review
recommendations.

## Readiness Report

The Readiness Report at `/readiness` is a training-readiness estimate, not a
guarantee of interview success.

v0.6 readiness includes:

- Interview Performance.
- Rubric Breakdown.
- Interview Weak Spots.
- Recommended Next Mock.

v0.7 readiness adds:

- Code Execution section.
- Self-test pass rate.
- Runtime stability.
- Testing discipline.
- Debugging signals from runtime errors and repeated failed custom tests.

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

Optional local Code Workspace variable:

```text
PATTERNFORGE_PYTHON_BIN="python3"
```

`PATTERNFORGE_PYTHON_BIN` is read by the server-side development runner only.
It is never needed in the browser and must not be prefixed with `NEXT_PUBLIC_`.

## Code Execution Security

PatternForge v0.7 code execution is server-side only. Browser components call
authenticated server actions, and saved code submissions, code runs, custom
tests, and Debug Coach insights are always scoped to the current `UserProfile`.
Users can only run code linked to attempts, interview rounds, and battle rounds
they own.

The local Python runner is a controlled MVP development path, not a production
sandbox. It writes user code into a disposable temporary directory, launches
Python with a minimal secret-free environment, applies strict code/input/test
count/output/time limits, blocks unsupported languages, blocks common network
and process-spawn paths, guards file access to the temporary run directory, and
removes the temporary directory after the run. Runner errors are sanitized
before being returned or saved.

Production deployments must not run untrusted user code in the main app process
or on the same host that has database, auth, or AI provider secrets. Production
requires an isolated execution service such as a per-run container, microVM, or
managed sandbox with:

- No network egress by default.
- No app, database, auth, or AI environment variables.
- Disposable filesystem with no persistent host mounts.
- Read-only runtime image except for a temporary work directory.
- CPU, memory, process, file, and wall-clock limits.
- Output and input caps matching or stricter than the app limits.
- Structured result passing back to the app, not shell interpolation.

The app intentionally reports PatternForge results as custom tests or self-tests
only. It does not claim official LeetCode acceptance, does not submit to
LeetCode, and does not scrape or store LeetCode problem statements or official
examples.

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

The v0.1-v0.7 migrations are additive. They add auth-backed progress, AI Coach,
review scheduling, battles, recommendations, learning plans, contrast drills,
interviews, interview rewards, interview recommendations, code workspace tables,
test results, debug insights, and execution recommendation types without
deleting existing app data.

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

## How To Test Code Workspace

1. Configure Clerk and PostgreSQL, then run migrations and seed data.
2. Sign in.
3. Open a problem workspace, for example
   `/problems/two-sum/workspace?mode=Practice`.
4. Confirm the page shows metadata, external link, Python editor, custom test
   builder, run results panel, and submission history.
5. Add a custom test with valid input JSON and expected output JSON.
6. Save custom tests and confirm they reappear as user/custom tests, not
   official examples.
7. Write Python code and click Run custom tests.
8. Confirm a `CodeSubmission`, `CodeRun`, and `TestResult` are saved, and the
   results panel shows status, runtime, stdout, stderr, expected output, actual
   output, and pass/fail per custom test.
9. Create a failing run and use Debug Coach. Confirm a `DebugInsight` is saved
   and can create a flashcard or mistake card when enough context exists.
10. Open `/code/history` and confirm the submission appears with latest run
    status, custom tests passed/failed, linked context, and workspace CTA.
11. Complete a normal practice attempt after using the workspace and confirm
    the saved code links to the created `Attempt`.
12. Open an interview implementation phase and a battle round workspace and
    confirm code saves with `InterviewRound` and `BattleRound` context.
13. Try another user's code submission or run ID while signed in as a different
    user and confirm the action is rejected or returns not found.
14. Open `/readiness` and the dashboard to confirm execution signals and
    debugging/testing/implementation recommendations appear without hiding due
    reviews.

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

PatternForge intentionally excludes:

- Live voice mode.
- Video simulation.
- Social features.
- Leaderboards.
- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Automatic submission to LeetCode.
- Official LeetCode execution or acceptance claims.
- A production-grade code execution sandbox in the main Next.js process. The
  local Python runner is development-only until an isolated executor is
  configured.
- Payments or subscriptions.
- Public sharing of private progress.

## Known Limitations

- v0.7 starts with Python-only custom/self-test execution.
- Local code execution is development-only and must be replaced by an isolated
  execution environment before public production use.
- AI scoring is feedback, not a guarantee of correctness or hiring outcome.
- Live AI requires server-side AI provider credentials. Without them,
  deterministic fallback interviewer and scoring logic is used.
- Local migration and DB integration checks require a valid PostgreSQL user,
  password, and database in `DATABASE_URL`.
- Clerk development keys produce local browser warnings. Production deployments
  should use production Clerk keys.

## Roadmap

### v0.8 Voice Mode

- Voice-mode interview practice.
- Transcript persistence.
- Staged interviewer hints.
- Communication scoring from spoken answers.
- Review cards from voice-session weaknesses.

### v1.0 Full Learning System

- End-to-end adaptive curriculum.
- More durable long-term mastery and retention analytics.
- Richer review tuning from user feedback.
- Stronger personalized pacing across patterns, battles, reviews, plans, and
  interviews.
- Production hardening for observability, rate limits, operational support, and
  evaluation of AI outputs.

## Current v0.7 Summary

v0.7 adds the Code Workspace, Python custom runner, custom test persistence,
code submissions, code runs, test results, Debug Coach, debug insights, code
history, practice/interview/battle code links, readiness execution signals, and
debugging/testing/implementation recommendations.

To test it, configure auth and database credentials, run migrations and seed,
sign in, run the Code Workspace checklist, complete a mock interview through
every phase, then verify summaries, history, readiness, dashboard events,
recommendations, attempts, feedback, mistakes, flashcards, XP, achievements,
submissions, runs, test results, and debug insights.
