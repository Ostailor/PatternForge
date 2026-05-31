# PatternForge

PatternForge v0.0 is a local-only MVP prototype for learning coding interview
patterns through gamified practice. It helps users practice recognizing the
underlying pattern before solving, then reflect on what worked.

The app is built with Next.js, TypeScript, and Tailwind CSS.

## What v0.0 Includes

- Dashboard with local XP, streak, recognition accuracy, solved count, and
  best/weakest pattern stats.
- Pattern map with seeded pattern cards, mastery levels, progress bars, and
  recognition clues.
- Pattern detail pages with descriptions, template summaries, common mistakes,
  progress, and related seeded problems.
- Daily Forge session with three local practice problems: warm-up, main forge,
  and mixed review.
- Problem practice flow:
  - problem preview
  - pattern recognition quiz
  - reflection form
  - local session summary
- Seeded metadata for patterns and LeetCode problem links.
- Local progress storage using `localStorage`.
- Reset Local Progress button for testing.

## What v0.0 Does Not Include

- No backend.
- No authentication.
- No database.
- No real AI integration.
- No LeetCode scraping.
- No copied LeetCode problem statements.

Seeded problem data is limited to title, URL, difficulty, pattern metadata,
recognition clues, common mistakes, and estimated time.

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

Run checks:

```bash
npm run typecheck
npm run lint
npm run build
npm test
```

## Local Data

Progress is stored in the browser under:

```text
patternforge_attempts_v0
patternforge.progress.v0
```

Use the dashboard's Reset Local Progress button to clear local attempts during
testing.

## Roadmap

- v0.1: database and authentication.
- v0.2: AI review for submitted reflections and solutions.
- v0.3: spaced repetition scheduling.
- v0.4: boss battles for high-pressure mixed drills.
- v0.5: mixed-pattern recommendation engine.
