const PATTERN_BOSS_MIN_PROBLEM_COUNT = 1;
const MIXED_BATTLE_RECOMMENDED_PROBLEM_COUNT = 5;
const REVIEW_GAUNTLET_RECOMMENDED_SIGNAL_COUNT = 3;

export type BattleStatsRoundInput = {
  wasPatternCorrect: boolean | null;
};

export type BattleStatsInput = {
  battleType: string;
  result: string | null;
  targetPatternName?: string | null;
  rounds: BattleStatsRoundInput[];
};

export type BattleStatsSummary = {
  battlesCompleted: number;
  victories: number;
  partialVictories: number;
  averageRecognitionAccuracy: number;
  bestBossPattern: string;
};

type BossPatternStanding = {
  name: string;
  victories: number;
  completions: number;
};

export function canStartPatternBoss(problemCount: number): boolean {
  return problemCount >= PATTERN_BOSS_MIN_PROBLEM_COUNT;
}

export function isMixedBattleRecommended(attemptedProblemCount: number): boolean {
  return attemptedProblemCount >= MIXED_BATTLE_RECOMMENDED_PROBLEM_COUNT;
}

export function isReviewGauntletRecommended(reviewSignalCount: number): boolean {
  return reviewSignalCount >= REVIEW_GAUNTLET_RECOMMENDED_SIGNAL_COUNT;
}

export function summarizeBattleStats(
  completedBattles: BattleStatsInput[],
): BattleStatsSummary {
  const recognitionRounds = completedBattles.flatMap((battle) =>
    battle.rounds.filter(
      (round): round is { wasPatternCorrect: boolean } =>
        typeof round.wasPatternCorrect === "boolean",
    ),
  );
  const correctRecognitionCount = recognitionRounds.filter(
    (round) => round.wasPatternCorrect,
  ).length;
  const bossPatternStandings = new Map<string, BossPatternStanding>();

  for (const battle of completedBattles) {
    if (battle.battleType !== "PatternBoss" || !battle.targetPatternName) {
      continue;
    }

    const standing = bossPatternStandings.get(battle.targetPatternName) ?? {
      name: battle.targetPatternName,
      victories: 0,
      completions: 0,
    };

    standing.completions += 1;

    if (battle.result === "Victory") {
      standing.victories += 1;
    }

    bossPatternStandings.set(battle.targetPatternName, standing);
  }

  const bestBossPattern =
    Array.from(bossPatternStandings.values()).sort(
      (a, b) =>
        b.victories - a.victories ||
        b.completions - a.completions ||
        a.name.localeCompare(b.name),
    )[0]?.name ?? "No boss clears yet";

  return {
    battlesCompleted: completedBattles.length,
    victories: completedBattles.filter((battle) => battle.result === "Victory")
      .length,
    partialVictories: completedBattles.filter(
      (battle) => battle.result === "PartialVictory",
    ).length,
    averageRecognitionAccuracy:
      recognitionRounds.length === 0
        ? 0
        : Math.round((correctRecognitionCount / recognitionRounds.length) * 100),
    bestBossPattern,
  };
}
