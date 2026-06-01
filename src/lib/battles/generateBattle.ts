import type { Prisma } from "@/generated/prisma/client";
import { getPrisma } from "@/lib/prisma";

import {
  buildMixedBattleConfig,
  buildPatternBossConfig,
  buildReviewGauntletConfig,
  calculatePatternMastery,
} from "./battleRules";
import type {
  BattleConfig,
  BattleProblemCandidate,
  BattleUserAttempt,
  CreatedBattle,
  PublicBattleProblemMetadata,
} from "./types";

type DbProblemForBattle = Awaited<ReturnType<typeof loadBattleProblems>>[number];
type CreatedBattleRecord = Prisma.BattleGetPayload<{
  include: {
    rounds: {
      include: {
        problem: {
          include: {
            problemPatterns: true;
          };
        };
      };
    };
  };
}>;

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function toPublicProblemMetadata(problem: DbProblemForBattle): PublicBattleProblemMetadata {
  return {
    id: problem.id,
    title: problem.title,
    url: problem.url,
    difficulty: problem.difficulty,
    estimatedMinutes: problem.estimatedMinutes,
    recognitionClues: problem.recognitionClues,
    commonMistakes: problem.commonMistakes,
  };
}

function toCreatedBattle(battle: CreatedBattleRecord): CreatedBattle {
  return {
    id: battle.id,
    battleType: battle.battleType,
    title: battle.title,
    targetPatternId: battle.targetPatternId,
    status: battle.status,
    startedAt: battle.startedAt.toISOString(),
    completedAt: battle.completedAt?.toISOString() ?? null,
    totalRounds: battle.totalRounds,
    xpEarned: battle.xpEarned,
    result: battle.result,
    rounds: battle.rounds
      .slice()
      .sort((a, b) => a.roundNumber - b.roundNumber)
      .map((round) => ({
        id: round.id,
        battleId: round.battleId,
        roundNumber: round.roundNumber,
        roundType: round.roundType,
        attemptId: round.attemptId,
        completedAt: round.completedAt?.toISOString() ?? null,
        problem: toPublicProblemMetadata(round.problem),
      })),
  };
}

function toProblemCandidate(problem: DbProblemForBattle): BattleProblemCandidate | null {
  const primaryPattern = problem.problemPatterns.find(
    (problemPattern) => problemPattern.isPrimary,
  );

  if (!primaryPattern) {
    return null;
  }

  return {
    id: problem.id,
    title: problem.title,
    url: problem.url,
    difficulty: problem.difficulty,
    estimatedMinutes: problem.estimatedMinutes,
    recognitionClues: problem.recognitionClues,
    commonMistakes: problem.commonMistakes,
    primaryPatternId: primaryPattern.patternId,
    secondaryPatternIds: problem.problemPatterns
      .filter((problemPattern) => !problemPattern.isPrimary)
      .map((problemPattern) => problemPattern.patternId),
  };
}

async function loadBattleProblems() {
  return getPrisma().problem.findMany({
    include: {
      problemPatterns: true,
    },
    orderBy: [{ estimatedMinutes: "asc" }, { title: "asc" }],
  });
}

async function loadBattleProblemCandidates(): Promise<BattleProblemCandidate[]> {
  const problems = await loadBattleProblems();

  return problems
    .map(toProblemCandidate)
    .filter((problem): problem is BattleProblemCandidate => problem !== null);
}

async function loadUserAttempts(
  userProfileId: string,
): Promise<BattleUserAttempt[]> {
  const attempts = await getPrisma().attempt.findMany({
    where: { userProfileId },
    select: {
      problemId: true,
      correctPatternId: true,
      wasPatternCorrect: true,
      solvedStatus: true,
      confidence: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return attempts.map((attempt) => ({
    problemId: attempt.problemId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: attempt.solvedStatus,
    confidence: attempt.confidence,
    createdAt: attempt.createdAt,
  }));
}

async function loadReviewSignalPatternIds(userProfileId: string): Promise<string[]> {
  const [mistakes, difficultReviewLogs] = await Promise.all([
    getPrisma().mistake.findMany({
      where: {
        userProfileId,
        status: "active",
      },
      select: {
        patternId: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getPrisma().reviewLog.findMany({
      where: {
        userProfileId,
        rating: {
          in: ["Again", "Hard"],
        },
      },
      select: {
        flashcard: {
          select: {
            patternId: true,
          },
        },
        mistake: {
          select: {
            patternId: true,
          },
        },
      },
      orderBy: { reviewedAt: "desc" },
      take: 50,
    }),
  ]);

  return uniqueValues([
    ...mistakes.map((mistake) => mistake.patternId),
    ...difficultReviewLogs.map(
      (reviewLog) =>
        reviewLog.flashcard?.patternId ?? reviewLog.mistake?.patternId ?? "",
    ),
  ]);
}

function withTitle(config: BattleConfig, title: string): BattleConfig {
  return {
    ...config,
    title,
  };
}

export async function createBattleFromRounds(
  userProfileId: string,
  battleConfig: BattleConfig,
): Promise<CreatedBattle> {
  if (battleConfig.rounds.length === 0) {
    throw new Error("Battle must include at least one round.");
  }

  const battle = await getPrisma().battle.create({
    data: {
      userProfileId,
      battleType: battleConfig.battleType,
      title: battleConfig.title,
      targetPatternId: battleConfig.targetPatternId,
      totalRounds: battleConfig.rounds.length,
      rounds: {
        create: battleConfig.rounds.map((round) => ({
          problemId: round.problemId,
          roundNumber: round.roundNumber,
          roundType: round.roundType,
          expectedPatternId: round.expectedPatternId,
        })),
      },
    },
    include: {
      rounds: {
        include: {
          problem: {
            include: {
              problemPatterns: true,
            },
          },
        },
      },
    },
  });

  return toCreatedBattle(battle);
}

export async function generatePatternBoss(
  userProfileId: string,
  patternId: string,
): Promise<CreatedBattle> {
  const [pattern, problems, attempts] = await Promise.all([
    getPrisma().pattern.findUnique({
      where: { id: patternId },
      select: { name: true },
    }),
    loadBattleProblemCandidates(),
    loadUserAttempts(userProfileId),
  ]);

  if (!pattern) {
    throw new Error("Target pattern was not found.");
  }

  const config = buildPatternBossConfig({
    userProfileId,
    patternId,
    masteryScore: calculatePatternMastery(patternId, attempts),
    problems,
    attempts,
  });

  return createBattleFromRounds(
    userProfileId,
    withTitle(config, `${pattern.name} Boss Battle`),
  );
}

export async function generateMixedBattle(
  userProfileId: string,
): Promise<CreatedBattle> {
  const [problems, attempts] = await Promise.all([
    loadBattleProblemCandidates(),
    loadUserAttempts(userProfileId),
  ]);
  const config = buildMixedBattleConfig({
    userProfileId,
    problems,
    attempts,
  });

  return createBattleFromRounds(userProfileId, config);
}

export async function generateReviewGauntlet(
  userProfileId: string,
): Promise<CreatedBattle> {
  const [problems, attempts, reviewPatternIds] = await Promise.all([
    loadBattleProblemCandidates(),
    loadUserAttempts(userProfileId),
    loadReviewSignalPatternIds(userProfileId),
  ]);
  const config = buildReviewGauntletConfig({
    userProfileId,
    problems,
    attempts,
    reviewPatternIds,
  });

  return createBattleFromRounds(userProfileId, config);
}
