# PatternForge

PatternForge is a pattern-first coding interview practice app. It trains users
to recognize the underlying pattern before grinding repetitions: preview a
problem, choose the likely pattern, solve from the official problem link, save
an attempt reflection, and review mistakes and flashcards over time.

PatternForge stores app-owned learning metadata only. It does not scrape
LeetCode, call the LeetCode API, copy LeetCode problem statements, or submit
anything to LeetCode.

## Version Summary

### v0.0

- Local-only Next.js prototype.
- Pattern map, pattern detail pages, seeded problem metadata, and Daily Forge.
- Practice flow with pattern recognition, reflection, XP, streaks, and mastery.
- Browser-only progress in `localStorage`.

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
- AI-generated mistake cards and simple flashcards.
- Hint Mode with a five-level hint ladder.
- Guardrails for ownership, malformed AI output, input length, and daily AI
  review limits.

### v0.3

- Spaced repetition for flashcards and mistakes.
- Daily Review queue at `/review`.
- `ReviewLog` history for flashcard and mistake ratings.
- Review ratings: `Again`, `Hard`, `Good`, `Easy`.
- Review completion summary with XP, ratings, reviewed patterns, and reschedules.
- Mistake Journal at `/mistakes`.
- Flashcards page at `/flashcards`.
- Dashboard review widgets for due counts, retention, weakest review pattern,
  and memory streak.
- v0.3 mastery formula using attempts, AI explanation scores, review retention,
  and confidence.
- XP and streaks now include review activity.

## Spaced Repetition Behavior

Each active flashcard and mistake has:

- `reviewDueAt`
- `lastReviewedAt`
- `intervalDays`
- `easeFactor`
- `repetitions`
- `lapses`
- `status`

The v0.3 scheduler is intentionally simple:

- `Again`: next interval `1`, ease `-0.2`, repetitions reset, lapse count +1.
- `Hard`: next interval `max(2, round(interval * 1.2))`, ease `-0.1`.
- `Good`: next interval `max(3, round(interval * ease))`.
- `Easy`: next interval `max(5, round(interval * ease * 1.3))`, ease `+0.15`.

First reviews use fixed intervals: `Again = 1`, `Hard = 2`, `Good = 3`,
`Easy = 5`.

## Mistake Journal Behavior

The Mistake Journal shows the current user's mistakes only. It supports:

- Pattern filter.
- Status filter: active or archived.
- Review status filter: due or not due.
- Search by mistake text.
- Sort by newest, oldest, most lapses, or due soon.
- Archive action.
- Review-now action that makes the mistake due and opens Daily Review.

Mistake cards use encouraging language such as `Mistake Forged`, `Correction`,
`Next Review`, `Pattern`, and `Practice Signal`.

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Required:

```text
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

Optional AI Coach variables:

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

The v0.3 migration backfills existing flashcards and mistakes by setting
`reviewDueAt` from `createdAt` before making the field required.

## Seed Command

Seed patterns, problems, and problem-pattern relationships:

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

Open [http://localhost:3000](http://localhost:3000).

## How To Test Daily Review

1. Configure Clerk and PostgreSQL.
2. Run migrations and seed data.
3. Sign in.
4. Complete a Daily Forge attempt.
5. Run AI Coach on the saved attempt.
6. Confirm AI Coach creates flashcards or mistakes.
7. Open `/review`.
8. Start Daily Review.
9. Reveal each answer or correction.
10. Rate items with `Again`, `Hard`, `Good`, or `Easy`.
11. Confirm the completion summary shows reviewed counts, ratings, XP, patterns,
    and rescheduled items.
12. Open `/flashcards` and `/mistakes` to confirm next review dates and counts.

Useful focused checks:

```bash
npx tsx --test \
  src/lib/review/scheduler.test.ts \
  src/lib/review/queue.test.ts \
  src/lib/gamification.test.ts \
  src/lib/mastery.test.ts
```

## Verification Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
npx prisma migrate status
```

Run the broader local helper suite:

```bash
npx tsx --test \
  src/lib/ai-review-limits.test.ts \
  src/lib/ai/reviewSolution.test.ts \
  src/lib/ai/hints.test.ts \
  src/lib/ai/prompts.test.ts \
  src/lib/gamification.test.ts \
  src/lib/mastery.test.ts \
  src/lib/flashcard-journal.test.ts \
  src/lib/memory-streak.test.ts \
  src/lib/mistake-journal.test.ts \
  src/lib/review/scheduler.test.ts \
  src/lib/review/queue.test.ts
```

Run the AI review persistence integration test against a disposable database:

```bash
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public" \
  npx tsx --test src/lib/ai-review-db.integration.test.ts
```

## Intentionally Excluded

PatternForge v0.3 intentionally excludes:

- Boss battles.
- Social features.
- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Automatic submission to LeetCode.
- Complex recommendation engine.
- Payments or subscriptions.
- Public sharing of private progress.

## Roadmap

- v0.4: Boss battles with timed mixed-pattern challenge sessions.
- v0.5: Recommendation engine for personalized next problems and patterns.
- v1.0: Full learning system with durable review loops, personalized training,
  and end-to-end progress intelligence.
