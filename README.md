# PatternForge

PatternForge is a pattern-first coding interview training app. It helps users
practice the skill that usually matters before implementation: recognizing the
underlying pattern, solving from the official problem link, reflecting on the
attempt, and using reviews to strengthen weak spots over time.

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
- AI-generated mistake cards and flashcards.
- Hint Mode with a five-level hint ladder.
- Guardrails for ownership, malformed AI output, input length, and daily AI
  review limits.

### v0.3

- Spaced repetition for flashcards and mistakes.
- Daily Review queue at `/review`.
- `ReviewLog` history for flashcard and mistake ratings.
- Review ratings: `Again`, `Hard`, `Good`, `Easy`.
- Review completion summary with XP, ratings, reviewed patterns, and reschedules.
- Mistake Journal at `/mistakes` and flashcards page at `/flashcards`.
- Dashboard review widgets for due counts, retention, weakest review pattern,
  and memory streak.
- Mastery formula using attempts, AI explanation scores, review retention, and
  confidence.

### v0.4

- Boss Battles at `/battles`.
- Active battle flow at `/battles/[battleId]`.
- Battle summary at `/battles/[battleId]/summary`.
- Daily Quests on the dashboard.
- Achievements and badges at `/achievements`.
- Pattern Levels derived from existing mastery scores.
- Durable `GameEvent` XP ledger with legacy XP fallback.
- Dashboard game widgets for active battles, quests, recent events,
  achievements, and pattern progression.
- Completion-state components for XP, achievements, quests, level-ups, and
  battle results.

## Boss Battle Behavior

Boss Battles are database-backed training sessions made from seeded problem
metadata. Battle creation requires authentication and always scopes data to the
current `UserProfile`.

Battle types:

- `PatternBoss`: focuses on one target pattern and uses three to five rounds:
  `Warmup`, `MainForge`, `PatternTwist`, `MixedReview`, and `BossProblem`.
- `MixedBattle`: combines patterns the user has already practiced, balancing
  mastered, in-progress, and weak patterns.
- `ReviewGauntlet`: focuses on recent mistakes, difficult reviews, and low
  retention signals.

Battle rules:

- The correct pattern is not revealed before the recognition quiz.
- Problems come from the seeded PatternForge metadata bank only.
- Recently attempted problems are deprioritized, but repeats are allowed when
  the bank is small.
- Difficulty follows current mastery: low mastery favors Easy, medium mastery
  mixes Easy and Medium, and high mastery can include harder available problems.
- Completing a round creates or connects an `Attempt`, sets
  `BattleRound.attemptId`, and marks the round complete.
- Completing the last round scores the battle, awards XP once through
  `GameEvent`, updates quests, checks achievements, and redirects to summary.

Victory rules:

- `Victory`: recognition accuracy at least 80% and solved or partially solved at
  least 80% of rounds.
- `PartialVictory`: recognition accuracy at least 50% or solved or partially
  solved at least 50% of rounds.
- `Defeat`: below the partial victory threshold.

## Daily Quest Behavior

Daily Quests give small objectives that encourage consistency. Up to three
quests are generated per user per UTC day, idempotently.

Examples:

- Complete one problem attempt.
- Review three flashcards.
- Review one mistake.
- Complete one Boss Battle.
- Correctly recognize two patterns.
- Practice your weakest pattern.
- Complete all due reviews.

Quest progress updates after attempts, review logs, and battle completion. When
a quest reaches its target, PatternForge marks it completed and creates one
`QuestCompleted` `GameEvent` for the quest XP reward. Refreshing the page should
not double-award quest XP.

## Achievement System

Seeded v0.4 achievements:

- `First Forge`: complete your first attempt, 50 XP.
- `Pattern Scout`: correctly recognize 10 patterns, 75 XP.
- `Mistake Forger`: create 10 mistake cards, 75 XP.
- `Memory Smith`: complete 25 reviews, 100 XP.
- `Boss Slayer`: win your first Boss Battle, 100 XP.
- `Streak Spark`: maintain a 3-day memory streak, 75 XP.
- `Sliding Window Sharp`: reach 80% mastery in Sliding Window, 100 XP.
- `Review Gauntlet Survivor`: complete a Review Gauntlet, 100 XP.

`UserAchievement` has a unique user-achievement constraint, and achievement XP
is awarded through one `AchievementEarned` `GameEvent`.

## XP and GameEvent System

v0.4 uses `GameEvent` as a durable XP ledger. XP can come from attempts,
reviews, boss battles, quests, and achievements.

Core helpers live in `src/lib/game`:

- `createGameEvent(userProfileId, eventType, xpAmount, description, metadata)`
- `getTotalXP(userProfileId)`
- `getRecentGameEvents(userProfileId)`
- `getXPBreakdown(userProfileId)`

Duplicate XP is prevented with a stable `eventKey` derived from the user,
event type, and source metadata such as `attemptId`, `reviewLogId`, `battleId`,
`questId`, or `achievementId`. Existing attempt and review XP still has a
fallback path so v0.3 data continues to count until fully migrated.

## Pattern Levels

Pattern Levels are derived from the existing mastery score:

- 0%: Level 0, `Not Started`.
- 1-25%: Level 1, `Warming Up`.
- 26-50%: Level 2, `Apprentice`.
- 51-75%: Level 3, `Forging`.
- 76-90%: Level 4, `Sharp`.
- 91-100%: Level 5, `Mastered`.

Pattern Boss is available for any pattern with at least one seeded problem.
Mixed Battle is recommended after five attempts. Review Gauntlet is recommended
after at least three mistakes or reviews. These are soft recommendations, not
hard locks.

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

The v0.4 migration is additive. It creates battles, battle rounds, quests,
achievements, user achievements, game events, enums, indexes, and relationships
without deleting v0.3 data.

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

Open [http://localhost:3000](http://localhost:3000).

## How To Test Boss Battles

1. Configure Clerk and PostgreSQL.
2. Run migrations and seed data.
3. Sign in.
4. Open `/battles`.
5. Start a Pattern Boss for Arrays & Hashing.
6. Complete each round and confirm an attempt is saved.
7. Confirm `BattleRound.attemptId` is populated after each round.
8. Finish the last round and confirm redirect to battle summary.
9. Confirm the summary shows result, XP, recognition accuracy, solved counts,
   tested patterns, and round breakdown.
10. Refresh the summary and confirm XP does not increase again.
11. Start a Mixed Battle after a few attempts.
12. Create mistakes or reviews, then start a Review Gauntlet.

Useful focused checks:

```bash
npx tsx --test \
  src/lib/battles/battleRules.test.ts \
  src/lib/battles/scoreBattle.test.ts \
  src/lib/battles/completion.test.ts \
  src/lib/game/events.test.ts \
  src/lib/game/xp.test.ts
```

## How To Test Daily Review

1. Sign in and complete a Daily Forge attempt.
2. Run AI Coach on the saved attempt.
3. Confirm AI Coach creates flashcards or mistakes.
4. Open `/review`.
5. Start Daily Review.
6. Reveal each answer or correction.
7. Rate items with `Again`, `Hard`, `Good`, or `Easy`.
8. Confirm the completion summary shows reviewed counts, ratings, XP, patterns,
   and rescheduled items.
9. Open `/flashcards` and `/mistakes` to confirm next review dates and counts.

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
  src/lib/battles/battleRules.test.ts \
  src/lib/battles/completion.test.ts \
  src/lib/battles/dashboard.test.ts \
  src/lib/battles/scoreBattle.test.ts \
  src/lib/flashcard-journal.test.ts \
  src/lib/game/events.test.ts \
  src/lib/game/xp.test.ts \
  src/lib/gamification.test.ts \
  src/lib/mastery.test.ts \
  src/lib/memory-streak.test.ts \
  src/lib/mistake-journal.test.ts \
  src/lib/review/queue.test.ts \
  src/lib/review/scheduler.test.ts
```

Run the AI review persistence integration test against a disposable database:

```bash
DATABASE_URL="postgresql://patternforge:patternforge@localhost:5432/patternforge?schema=public" \
  npx tsx --test src/lib/ai-review-db.integration.test.ts
```

## Intentionally Excluded

PatternForge v0.4 intentionally excludes:

- Advanced recommendation engine.
- Social features.
- Leaderboards.
- LeetCode API integration.
- LeetCode scraping.
- Copied LeetCode problem statements.
- Automatic submission to LeetCode.
- Payments or subscriptions.
- Public sharing of private progress.

## Roadmap

- v0.5: Recommendation engine for personalized next problems, patterns, and
  review timing.
- v1.0: Full learning system with durable review loops, personalized training,
  richer analytics, and end-to-end progress intelligence.
