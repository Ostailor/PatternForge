# PatternForge

PatternForge is a pattern-first coding interview practice app. It helps users
train recognition before repetition: preview a problem, guess the underlying
pattern, solve from the official LeetCode link, and save a reflection that builds
XP, streaks, and mastery.

PatternForge stores only app-owned learning metadata. It does not store or copy
LeetCode problem statements.

## v0.0 Summary

PatternForge v0.0 was a local-only Next.js prototype. It included:

- A dashboard with XP, streaks, recognition accuracy, solved counts, and
  best/weakest pattern stats.
- A seeded pattern map and pattern detail pages.
- A Daily Forge session generator.
- A problem practice flow with preview, recognition quiz, reflection, and
  session summary.
- Seeded pattern/problem metadata with LeetCode links.
- Browser-only progress stored in `localStorage`.

## v0.1 Features

PatternForge v0.1 upgrades the prototype into a persistent app:

- Clerk authentication with sign-up, sign-in, sign-out, and user menu.
- PostgreSQL persistence through Prisma.
- `UserProfile` records mapped to Clerk user IDs.
- Seeded pattern metadata, problem metadata, and primary/secondary pattern
  relationships.
- Database-backed attempts with repeated attempts allowed.
- Dashboard stats from authenticated user attempts.
- Pattern map and pattern detail mastery for signed-in users.
- Public browsing for landing/dashboard explanation, pattern map, pattern
  details, and problem metadata.
- Sign-in prompts before saving progress.
- Optional import banner for legacy v0.0 local attempts from
  `patternforge_attempts_v0`.

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

`DATABASE_URL` must point to a PostgreSQL database. Clerk keys must come from a
Clerk application configured for the local development origin.

## Database Setup

Create a local PostgreSQL database by your preferred method. One Docker option:

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

## Migration Commands

For local development, apply migrations with:

```bash
npm run prisma:migrate
```

For a deploy-style migration check against an existing database:

```bash
npx prisma migrate deploy
```

Validate the Prisma schema:

```bash
npx prisma validate
```

Inspect local data with Prisma Studio:

```bash
npm run prisma:studio
```

## Seed Command

Seed the v0.0 pattern and problem metadata into the database:

```bash
npm run db:seed
```

The seed is idempotent. It upserts patterns, problems, and problem-pattern
relationships without creating duplicates.

Seeded problem records include only:

- Title
- LeetCode URL
- Difficulty
- Estimated minutes
- Recognition clues
- Common mistakes
- Pattern relationships

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run verification checks:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npx prisma validate
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

PatternForge v0.1 intentionally does not include:

- AI feedback or AI review.
- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Subscriptions, payments, or social features.
- Public sharing of private progress.

## Roadmap

- v0.2: AI review for reflections and submitted solution reasoning.
- v0.3: Spaced repetition scheduling for weak patterns.
- v0.4: Boss battles with timed mixed-pattern challenge sessions.
- v0.5: Recommendation engine for personalized next problems and patterns.
