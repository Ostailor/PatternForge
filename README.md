# PatternForge

PatternForge is a pattern-first coding interview practice app. It trains users
to recognize the underlying pattern before they grind repetitions: preview a
problem, choose the likely pattern, solve from the official LeetCode link, save
an attempt reflection, and review learning artifacts over time.

PatternForge stores app-owned learning metadata only. It does not scrape
LeetCode, call the LeetCode API, copy LeetCode problem statements, or submit
anything to LeetCode.

## Version Summaries

### v0.0

PatternForge v0.0 was the local-only prototype:

- Next.js dashboard with XP, streaks, recognition accuracy, solved counts, and
  best/weakest pattern stats.
- Seeded pattern map, pattern detail pages, and problem metadata.
- Daily Forge session generator.
- Problem practice flow with preview, pattern recognition quiz, reflection, and
  session summary.
- Browser-only progress in `localStorage`.

### v0.1

PatternForge v0.1 added persistence and authentication:

- Clerk authentication with sign-up, sign-in, sign-out, and user menu.
- PostgreSQL persistence through Prisma.
- `UserProfile` records mapped to Clerk user IDs.
- Database-backed attempts with repeated attempts allowed.
- Database-backed dashboard stats and pattern progress for signed-in users.
- Seeded patterns, problems, and primary/secondary pattern relationships.
- Public browsing for problem and pattern metadata.
- Sign-in prompts before saving attempts.
- Optional legacy import from `patternforge_attempts_v0`.

### v0.2

PatternForge v0.2 adds AI Coach support:

- Optional Coach Review on the session summary page after an attempt is saved.
- Server-side AI provider abstraction under `src/lib/ai`.
- Structured AI review output with pattern, implementation, complexity, and
  explanation scores.
- Database-backed `AIReview`, `Mistake`, and `Flashcard` records.
- AI-generated mistake cards and simple flashcards.
- Review archive page at `/review`.
- Hint Mode on the practice page with a five-level hint ladder.
- Guardrails for authentication, attempt ownership, input length, malformed AI
  output, and per-user daily review limits.

## AI Coach Behavior

AI Coach acts like a coding interview pattern tutor, not a generic code
reviewer. It evaluates:

- Whether the user recognized the correct pattern.
- Why the pattern applies.
- Whether the implementation appears complete and likely correct.
- Time and space complexity reasoning.
- The most likely mistake.
- What to remember next time.
- Suggested mistake cards and simple flashcards for retention.

Product constraints:

- AI review uses only PatternForge metadata and user-provided content: problem
  title, difficulty, recognition clues, common mistakes, pattern metadata,
  selected pattern, attempt reflection, pasted code, and pasted explanation.
- AI review does not include or reconstruct LeetCode problem statements.
- Hint Mode reveals one hint at a time and avoids full code solutions.
- AI Coach must not claim code passed tests unless tests were actually run.
- v0.2 flashcards are intentionally simple: front, back, related pattern, and
  optional source attempt.

## Tech Stack

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Clerk authentication
- Prisma ORM
- PostgreSQL

## Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Required variables:

```text
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_me"
CLERK_SECRET_KEY="sk_test_replace_me"
```

`DATABASE_URL` must point to PostgreSQL. Clerk keys must come from a Clerk
application configured for the local development origin.

Optional AI Coach variables:

```text
AI_PROVIDER="openai-compatible"
AI_BASE_URL="https://api.example.com/v1"
AI_API_KEY="replace_with_server_side_key"
AI_MODEL="replace_with_model_name"
```

The AI client also accepts `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
`OPENAI_MODEL` as fallbacks. Keep AI keys server-side only. Do not prefix AI
keys with `NEXT_PUBLIC_`, because public environment variables are exposed to
the browser bundle.

## Run Locally

Install dependencies:

```bash
npm install
```

Start PostgreSQL. One Docker option:

```bash
docker run --name patternforge-db \
  -e POSTGRES_USER=patternforge \
  -e POSTGRES_PASSWORD=patternforge \
  -e POSTGRES_DB=patternforge \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Apply migrations and seed data:

```bash
npm run prisma:migrate
npm run db:seed
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Migrations

For local development:

```bash
npm run prisma:migrate
```

For deploy-style migration application:

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

Inspect local data:

```bash
npm run prisma:studio
```

## Seed Database

Seed patterns, problems, and problem-pattern relationships:

```bash
npm run db:seed
```

The seed is idempotent. Seeded problem records include only:

- Title
- Official LeetCode URL
- Difficulty
- Estimated minutes
- Recognition clues
- Common mistakes
- Pattern relationships

## Test AI Review

1. Configure Clerk, database, and optional AI provider environment variables.
2. Run migrations and seed the database.
3. Start the app with `npm run dev`.
4. Sign in.
5. Open a problem, complete the recognition quiz, and save an attempt.
6. On the session summary page, paste code, an explanation, or both.
7. Click `Review with AI Coach`.
8. Confirm the review appears, then open `/review` to see recent Coach Reviews,
   Mistake Forged cards, and Flashcard Created cards.

Expected guardrails:

- Signed-out users cannot save AI reviews.
- Users cannot review attempts owned by another user.
- Overlong code or explanation input returns a friendly validation error.
- Malformed provider output returns a recoverable error instead of crashing.
- Users are limited to 5 AI reviews per UTC day in v0.2.

## Verification Commands

Run the core checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
```

Run focused AI parser and hint tests:

```bash
npx tsx --test \
  src/lib/ai-review-limits.test.ts \
  src/lib/ai/reviewSolution.test.ts \
  src/lib/ai/hints.test.ts \
  src/lib/ai/prompts.test.ts \
  src/lib/mastery.test.ts
```

Run the AI review persistence integration test against a disposable database:

```bash
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public" \
  npx tsx --test src/lib/ai-review-db.integration.test.ts
```

## Legacy Local Data

PatternForge v0.0 stored progress in the browser under:

```text
patternforge_attempts_v0
patternforge.progress.v0
```

After sign-in, v0.1 checks for `patternforge_attempts_v0` and offers a
non-blocking import banner. Users can import local attempts into their account,
ignore the prompt, or clear the old browser progress.

## Intentionally Excluded

PatternForge v0.2 intentionally does not include:

- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Automatic submission to LeetCode.
- Boss battles.
- Full spaced repetition scheduling, due dates, ease scores, intervals, or
  Anki-style grading.
- Subscriptions, payments, or social features.
- Public sharing of private progress.

## Roadmap

- v0.3: Spaced repetition and a deeper mistake journal.
- v0.4: Boss battles with timed mixed-pattern challenge sessions.
- v0.5: Recommendation engine for personalized next problems and patterns.
- v1.0: Full learning system with durable review loops, personalized training,
  and end-to-end progress intelligence.
