import {
  SolvedStatus as PrismaSolvedStatus,
  type Attempt as DbAttempt,
} from "@/generated/prisma/client";
import { getGamificationStats } from "@/lib/gamification";
import { getPatternProgress } from "@/lib/mastery";
import { getPrisma } from "@/lib/prisma";
import { progressFromAttempts } from "@/lib/progress";
import type {
  Attempt,
  Confidence,
  PatternProgress,
  SolvedStatus,
  UserProgress,
} from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type CreateAttemptInput = {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  createdAt?: string;
};

export type UserProgressSnapshot = {
  progress: UserProgress | null;
  dashboardStats: ReturnType<typeof getGamificationStats> | null;
  patternProgress: PatternProgress | null;
};

export type ImportAttemptsResult = {
  importedCount: number;
  skippedCount: number;
};

function toSolvedStatus(solvedStatus: PrismaSolvedStatus): SolvedStatus {
  switch (solvedStatus) {
    case PrismaSolvedStatus.Solved:
      return "Solved";
    case PrismaSolvedStatus.PartiallySolved:
      return "Partially Solved";
    case PrismaSolvedStatus.NotSolved:
      return "Not Solved";
  }
}

function toPrismaSolvedStatus(solvedStatus: SolvedStatus): PrismaSolvedStatus {
  switch (solvedStatus) {
    case "Solved":
      return PrismaSolvedStatus.Solved;
    case "Partially Solved":
      return PrismaSolvedStatus.PartiallySolved;
    case "Not Solved":
      return PrismaSolvedStatus.NotSolved;
  }
}

export function toAppAttempt(attempt: DbAttempt): Attempt {
  return {
    id: attempt.id,
    problemId: attempt.problemId,
    selectedPatternId: attempt.selectedPatternId,
    correctPatternId: attempt.correctPatternId,
    wasPatternCorrect: attempt.wasPatternCorrect,
    solvedStatus: toSolvedStatus(attempt.solvedStatus),
    timeSpentMinutes: attempt.timeSpentMinutes,
    confidence: attempt.confidence as Attempt["confidence"],
    reflection: attempt.reflection,
    createdAt: attempt.createdAt.toISOString(),
  };
}

function normalizeCreatedAt(createdAt?: string): string | undefined {
  if (!createdAt) {
    return undefined;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function getImportKey({
  problemId,
  selectedPatternId,
  solvedStatus,
  createdAt,
}: {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  createdAt?: string;
}) {
  return [
    problemId,
    selectedPatternId,
    solvedStatus,
    normalizeCreatedAt(createdAt) ?? "no-date",
  ].join("|");
}

export async function getCurrentUserAttempts(): Promise<Attempt[] | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const attempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    orderBy: { createdAt: "asc" },
  });

  return attempts.map(toAppAttempt);
}

export async function getCurrentUserProgress() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  return progressFromAttempts(attempts);
}

export async function getCurrentUserPatternProgress(
  patternId: string,
): Promise<PatternProgress | null> {
  const progress = await getCurrentUserProgress();

  if (!progress) {
    return null;
  }

  return getPatternProgress(patternId, progress);
}

export async function getCurrentUserDashboardStats() {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return null;
  }

  return getGamificationStats(attempts);
}

export async function getCurrentUserProgressSnapshot(
  patternId?: string,
): Promise<UserProgressSnapshot> {
  const attempts = await getCurrentUserAttempts();

  if (!attempts) {
    return {
      progress: null,
      dashboardStats: null,
      patternProgress: null,
    };
  }

  const progress = progressFromAttempts(attempts);

  return {
    progress,
    dashboardStats: getGamificationStats(attempts),
    patternProgress: patternId ? getPatternProgress(patternId, progress) : null,
  };
}

export async function createAttemptForUserProfile(
  userProfileId: string,
  input: CreateAttemptInput,
): Promise<Attempt> {
  const prisma = getPrisma();
  const [problem, selectedPattern] = await Promise.all([
    prisma.problem.findUnique({
      where: { id: input.problemId },
      include: {
        problemPatterns: {
          where: { isPrimary: true },
          take: 1,
        },
      },
    }),
    prisma.pattern.findUnique({
      where: { id: input.selectedPatternId },
    }),
  ]);

  const correctPatternId = problem?.problemPatterns[0]?.patternId;

  if (!problem || !correctPatternId) {
    throw new Error("Problem seed data was not found.");
  }

  if (!selectedPattern) {
    throw new Error("Selected pattern was not found.");
  }

  const createdAt = normalizeCreatedAt(input.createdAt);
  const dbAttempt = await prisma.attempt.create({
    data: {
      userProfileId,
      problemId: input.problemId,
      selectedPatternId: input.selectedPatternId,
      correctPatternId,
      wasPatternCorrect: input.selectedPatternId === correctPatternId,
      solvedStatus: toPrismaSolvedStatus(input.solvedStatus),
      timeSpentMinutes: input.timeSpentMinutes,
      confidence: input.confidence,
      reflection: input.reflection.trim(),
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
    },
  });

  return toAppAttempt(dbAttempt);
}

export async function createCurrentUserAttempt(
  input: CreateAttemptInput,
): Promise<Attempt | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  return createAttemptForUserProfile(userProfile.id, input);
}

export async function importCurrentUserAttempts(
  inputs: CreateAttemptInput[],
): Promise<ImportAttemptsResult | null> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return null;
  }

  const existingAttempts = await getPrisma().attempt.findMany({
    where: { userProfileId: userProfile.id },
    select: {
      problemId: true,
      selectedPatternId: true,
      solvedStatus: true,
      createdAt: true,
    },
  });
  const seen = new Set(
    existingAttempts.map((attempt) =>
      getImportKey({
        problemId: attempt.problemId,
        selectedPatternId: attempt.selectedPatternId,
        solvedStatus: toSolvedStatus(attempt.solvedStatus),
        createdAt: attempt.createdAt.toISOString(),
      }),
    ),
  );
  let importedCount = 0;
  let skippedCount = 0;

  for (const input of inputs) {
    const key = getImportKey(input);

    if (seen.has(key)) {
      skippedCount += 1;
      continue;
    }

    try {
      const importedAttempt = await createAttemptForUserProfile(
        userProfile.id,
        input,
      );
      seen.add(key);
      seen.add(getImportKey(importedAttempt));
      importedCount += 1;
    } catch {
      skippedCount += 1;
    }
  }

  return { importedCount, skippedCount };
}
