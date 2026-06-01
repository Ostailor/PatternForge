import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMixedBattleConfig,
  buildPatternBossConfig,
  buildReviewGauntletConfig,
  getDifficultyPreference,
} from "@/lib/battles/battleRules";
import type { BattleProblemCandidate, BattleUserAttempt } from "@/lib/battles/types";

const candidates: BattleProblemCandidate[] = [
  {
    id: "arrays-easy-old",
    title: "Arrays Easy Old",
    url: "https://leetcode.com/problems/arrays-easy-old/",
    difficulty: "Easy",
    estimatedMinutes: 10,
    recognitionClues: ["lookup"],
    commonMistakes: [],
    primaryPatternId: "arrays-hashing",
    secondaryPatternIds: [],
  },
  {
    id: "arrays-easy-new",
    title: "Arrays Easy New",
    url: "https://leetcode.com/problems/arrays-easy-new/",
    difficulty: "Easy",
    estimatedMinutes: 12,
    recognitionClues: ["counts"],
    commonMistakes: [],
    primaryPatternId: "arrays-hashing",
    secondaryPatternIds: [],
  },
  {
    id: "arrays-medium",
    title: "Arrays Medium",
    url: "https://leetcode.com/problems/arrays-medium/",
    difficulty: "Medium",
    estimatedMinutes: 25,
    recognitionClues: ["grouping"],
    commonMistakes: [],
    primaryPatternId: "arrays-hashing",
    secondaryPatternIds: [],
  },
  {
    id: "arrays-hard",
    title: "Arrays Hard",
    url: "https://leetcode.com/problems/arrays-hard/",
    difficulty: "Hard",
    estimatedMinutes: 45,
    recognitionClues: ["hard"],
    commonMistakes: [],
    primaryPatternId: "arrays-hashing",
    secondaryPatternIds: [],
  },
  {
    id: "pointers-easy",
    title: "Pointers Easy",
    url: "https://leetcode.com/problems/pointers-easy/",
    difficulty: "Easy",
    estimatedMinutes: 10,
    recognitionClues: ["two ends"],
    commonMistakes: [],
    primaryPatternId: "two-pointers",
    secondaryPatternIds: [],
  },
  {
    id: "pointers-medium",
    title: "Pointers Medium",
    url: "https://leetcode.com/problems/pointers-medium/",
    difficulty: "Medium",
    estimatedMinutes: 22,
    recognitionClues: ["pair"],
    commonMistakes: [],
    primaryPatternId: "two-pointers",
    secondaryPatternIds: [],
  },
  {
    id: "window-easy",
    title: "Window Easy",
    url: "https://leetcode.com/problems/window-easy/",
    difficulty: "Easy",
    estimatedMinutes: 11,
    recognitionClues: ["range"],
    commonMistakes: [],
    primaryPatternId: "sliding-window",
    secondaryPatternIds: [],
  },
  {
    id: "stack-medium",
    title: "Stack Medium",
    url: "https://leetcode.com/problems/stack-medium/",
    difficulty: "Medium",
    estimatedMinutes: 24,
    recognitionClues: ["latest"],
    commonMistakes: [],
    primaryPatternId: "stack",
    secondaryPatternIds: [],
  },
];

const recentAttempts: BattleUserAttempt[] = [
  {
    problemId: "arrays-easy-old",
    correctPatternId: "arrays-hashing",
    wasPatternCorrect: true,
    solvedStatus: "Solved",
    confidence: 4,
    createdAt: "2026-06-01T12:00:00.000Z",
  },
];

test("getDifficultyPreference maps mastery to simple difficulty bands", () => {
  assert.deepEqual(getDifficultyPreference(20), ["Easy", "Medium", "Hard"]);
  assert.deepEqual(getDifficultyPreference(60), ["Easy", "Medium", "Hard"]);
  assert.deepEqual(getDifficultyPreference(90), ["Medium", "Easy", "Hard"]);
});

test("buildPatternBossConfig creates ordered battle rounds and deprioritizes recent attempts", () => {
  const config = buildPatternBossConfig({
    userProfileId: "user-1",
    patternId: "arrays-hashing",
    masteryScore: 30,
    problems: candidates,
    attempts: recentAttempts,
  });

  assert.equal(config.battleType, "PatternBoss");
  assert.equal(config.targetPatternId, "arrays-hashing");
  assert.deepEqual(
    config.rounds.map((round) => round.roundType),
    ["Warmup", "MainForge", "PatternTwist", "MixedReview", "BossProblem"],
  );
  assert.equal(config.rounds[0].problemId, "arrays-easy-new");
  assert.equal(config.rounds[3].expectedPatternId, "two-pointers");
  assert.ok(config.rounds.length >= 3);
  assert.ok(config.rounds.length <= 5);
});

test("buildMixedBattleConfig mixes practiced weak, in-progress, and mastered patterns", () => {
  const config = buildMixedBattleConfig({
    userProfileId: "user-1",
    problems: candidates,
    attempts: [
      ...recentAttempts,
      {
        problemId: "pointers-easy",
        correctPatternId: "two-pointers",
        wasPatternCorrect: true,
        solvedStatus: "Solved",
        confidence: 5,
        createdAt: "2026-05-20T12:00:00.000Z",
      },
      {
        problemId: "window-easy",
        correctPatternId: "sliding-window",
        wasPatternCorrect: false,
        solvedStatus: "Not Solved",
        confidence: 2,
        createdAt: "2026-05-21T12:00:00.000Z",
      },
    ],
  });

  assert.equal(config.battleType, "MixedBattle");
  assert.ok(
    new Set(config.rounds.map((round) => round.expectedPatternId)).size >= 3,
  );
});

test("buildReviewGauntletConfig prioritizes review signal patterns", () => {
  const config = buildReviewGauntletConfig({
    userProfileId: "user-1",
    problems: candidates,
    attempts: [],
    reviewPatternIds: ["stack", "two-pointers"],
  });

  assert.equal(config.battleType, "ReviewGauntlet");
  assert.deepEqual(
    config.rounds.slice(0, 2).map((round) => round.expectedPatternId),
    ["stack", "two-pointers"],
  );
});
