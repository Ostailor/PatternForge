import { calculateMasteryScore } from "@/lib/mastery";
import type { Attempt, Difficulty } from "@/lib/types";

import type {
  BattleConfig,
  BattleProblemCandidate,
  BattleRoundConfig,
  BattleUserAttempt,
} from "./types";

const BATTLE_ROUND_TYPES = [
  "Warmup",
  "MainForge",
  "PatternTwist",
  "MixedReview",
  "BossProblem",
] as const;

const difficultyRank: Record<Difficulty, number> = {
  Easy: 1,
  Medium: 2,
  Hard: 3,
};

type PatternBossInput = {
  userProfileId: string;
  patternId: string;
  masteryScore: number;
  problems: BattleProblemCandidate[];
  attempts: BattleUserAttempt[];
};

type MixedBattleInput = {
  userProfileId: string;
  problems: BattleProblemCandidate[];
  attempts: BattleUserAttempt[];
};

type ReviewGauntletInput = MixedBattleInput & {
  reviewPatternIds: string[];
};

type RoundSelection = {
  roundType: (typeof BATTLE_ROUND_TYPES)[number];
  patternId: string;
  excludePatternId?: string;
  masteryScore: number;
};

export function getDifficultyPreference(masteryScore: number): Difficulty[] {
  if (masteryScore >= 76) {
    return ["Medium", "Easy", "Hard"];
  }

  return ["Easy", "Medium", "Hard"];
}

function normalizeSolvedStatus(
  solvedStatus: BattleUserAttempt["solvedStatus"],
): Attempt["solvedStatus"] {
  if (solvedStatus === "PartiallySolved") {
    return "Partially Solved";
  }

  if (solvedStatus === "NotSolved") {
    return "Not Solved";
  }

  return solvedStatus;
}

function attemptForMastery(
  attempt: BattleUserAttempt,
  index: number,
): Attempt {
  return {
    id: `battle-attempt-${index}`,
    problemId: attempt.problemId,
    selectedPatternId: attempt.correctPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: normalizeSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: 0,
    confidence: Math.min(Math.max(attempt.confidence, 1), 5) as Attempt["confidence"],
    reflection: "",
    createdAt:
      attempt.createdAt instanceof Date
        ? attempt.createdAt.toISOString()
        : attempt.createdAt,
  };
}

export function calculatePatternMastery(
  patternId: string,
  attempts: BattleUserAttempt[],
): number {
  return calculateMasteryScore(
    attempts
      .filter((attempt) => attempt.correctPatternId === patternId)
      .map(attemptForMastery),
  );
}

function getRecentAttemptedProblemIds(attempts: BattleUserAttempt[]): Set<string> {
  return new Set(
    attempts
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .slice(0, 20)
      .map((attempt) => attempt.problemId),
  );
}

function getPatternProblems(
  problems: BattleProblemCandidate[],
  patternId: string,
): BattleProblemCandidate[] {
  return problems.filter((problem) => problem.primaryPatternId === patternId);
}

function getOtherPatternProblems(
  problems: BattleProblemCandidate[],
  excludedPatternId: string,
): BattleProblemCandidate[] {
  return problems.filter(
    (problem) => problem.primaryPatternId !== excludedPatternId,
  );
}

function sortProblemsForBattle({
  problems,
  attempts,
  masteryScore,
  usedProblemIds,
}: {
  problems: BattleProblemCandidate[];
  attempts: BattleUserAttempt[];
  masteryScore: number;
  usedProblemIds: Set<string>;
}): BattleProblemCandidate[] {
  const recentProblemIds = getRecentAttemptedProblemIds(attempts);
  const difficultyPreference = getDifficultyPreference(masteryScore);

  return problems.slice().sort((a, b) => {
    const usedDelta =
      Number(usedProblemIds.has(a.id)) - Number(usedProblemIds.has(b.id));
    const recentDelta =
      Number(recentProblemIds.has(a.id)) - Number(recentProblemIds.has(b.id));
    const difficultyDelta =
      difficultyPreference.indexOf(a.difficulty) -
      difficultyPreference.indexOf(b.difficulty);

    return (
      usedDelta ||
      recentDelta ||
      difficultyDelta ||
      difficultyRank[a.difficulty] - difficultyRank[b.difficulty] ||
      a.estimatedMinutes - b.estimatedMinutes ||
      a.title.localeCompare(b.title)
    );
  });
}

function chooseProblem({
  problems,
  attempts,
  masteryScore,
  usedProblemIds,
}: {
  problems: BattleProblemCandidate[];
  attempts: BattleUserAttempt[];
  masteryScore: number;
  usedProblemIds: Set<string>;
}): BattleProblemCandidate {
  const sortedProblems = sortProblemsForBattle({
    problems,
    attempts,
    masteryScore,
    usedProblemIds,
  });

  return sortedProblems[0] ?? problems[0];
}

function buildRounds({
  problems,
  attempts,
  selections,
}: {
  problems: BattleProblemCandidate[];
  attempts: BattleUserAttempt[];
  selections: RoundSelection[];
}): BattleRoundConfig[] {
  const usedProblemIds = new Set<string>();

  return selections
    .map((selection, index) => {
      const pool = selection.excludePatternId
        ? getOtherPatternProblems(problems, selection.excludePatternId)
        : getPatternProblems(problems, selection.patternId);
      const problem = chooseProblem({
        problems: pool.length > 0 ? pool : problems,
        attempts,
        masteryScore: selection.masteryScore,
        usedProblemIds,
      });

      usedProblemIds.add(problem.id);

      return {
        problemId: problem.id,
        roundNumber: index + 1,
        roundType: selection.roundType,
        expectedPatternId: problem.primaryPatternId,
      };
    })
    .filter((round) => Boolean(round.problemId));
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function getPracticedPatternIds(attempts: BattleUserAttempt[]): string[] {
  return uniqueValues(
    attempts
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .map((attempt) => attempt.correctPatternId),
  );
}

function getFallbackPatternIds(problems: BattleProblemCandidate[]): string[] {
  return uniqueValues(problems.map((problem) => problem.primaryPatternId));
}

function selectMixedPatternIds(
  problems: BattleProblemCandidate[],
  attempts: BattleUserAttempt[],
): string[] {
  const practicedPatternIds = getPracticedPatternIds(attempts);
  const sourcePatternIds =
    practicedPatternIds.length > 0
      ? practicedPatternIds
      : getFallbackPatternIds(problems);
  const byMastery = sourcePatternIds
    .map((patternId) => ({
      patternId,
      masteryScore: calculatePatternMastery(patternId, attempts),
    }))
    .sort(
      (a, b) =>
        a.masteryScore - b.masteryScore ||
        a.patternId.localeCompare(b.patternId),
    );
  const weak = byMastery.filter((item) => item.masteryScore < 51);
  const inProgress = byMastery.filter(
    (item) => item.masteryScore >= 51 && item.masteryScore < 91,
  );
  const mastered = byMastery.filter((item) => item.masteryScore >= 91);

  return uniqueValues([
    ...weak.map((item) => item.patternId),
    ...inProgress.map((item) => item.patternId),
    ...mastered.map((item) => item.patternId),
    ...sourcePatternIds,
  ]).slice(0, 5);
}

export function buildPatternBossConfig({
  patternId,
  masteryScore,
  problems,
  attempts,
}: PatternBossInput): BattleConfig {
  const selections: RoundSelection[] = [
    { roundType: "Warmup", patternId, masteryScore },
    { roundType: "MainForge", patternId, masteryScore },
    { roundType: "PatternTwist", patternId, masteryScore },
    {
      roundType: "MixedReview",
      patternId,
      excludePatternId: patternId,
      masteryScore,
    },
    { roundType: "BossProblem", patternId, masteryScore },
  ];

  return {
    battleType: "PatternBoss",
    title: "Pattern Boss Battle",
    targetPatternId: patternId,
    rounds: buildRounds({
      problems,
      attempts,
      selections,
    }),
  };
}

export function buildMixedBattleConfig({
  problems,
  attempts,
}: MixedBattleInput): BattleConfig {
  const patternIds = selectMixedPatternIds(problems, attempts);
  const selections = patternIds.map((patternId, index): RoundSelection => ({
    roundType: BATTLE_ROUND_TYPES[index] ?? "MixedReview",
    patternId,
    masteryScore: calculatePatternMastery(patternId, attempts),
  }));

  return {
    battleType: "MixedBattle",
    title: "Mixed Battle",
    rounds: buildRounds({
      problems,
      attempts,
      selections,
    }),
  };
}

export function buildReviewGauntletConfig({
  problems,
  attempts,
  reviewPatternIds,
}: ReviewGauntletInput): BattleConfig {
  const patternIds = uniqueValues([
    ...reviewPatternIds,
    ...selectMixedPatternIds(problems, attempts),
  ]).slice(0, 5);
  const selections = patternIds.map((patternId, index): RoundSelection => ({
    roundType: BATTLE_ROUND_TYPES[index] ?? "MixedReview",
    patternId,
    masteryScore: calculatePatternMastery(patternId, attempts),
  }));

  return {
    battleType: "ReviewGauntlet",
    title: "Review Gauntlet",
    rounds: buildRounds({
      problems,
      attempts,
      selections,
    }),
  };
}
