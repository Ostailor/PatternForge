import "server-only";

import type { Difficulty } from "@/generated/prisma/enums";
import { getPatternConfusions } from "@/lib/analytics/confusionMetrics";
import { getPatternMetrics } from "@/lib/analytics/patternMetrics";
import { getReadinessReport } from "@/lib/analytics/readinessMetrics";
import type { PatternMetric } from "@/lib/analytics/types";
import {
  DEFAULT_FOCUSED_PATTERN_MINUTES,
  DEFAULT_MIXED_INTERVIEW_MINUTES,
  DEFAULT_RECENT_ATTEMPT_DAYS,
  DEFAULT_SINGLE_PROBLEM_MINUTES,
  DEFAULT_WEAKNESS_REPAIR_MINUTES,
  SINGLE_PROBLEM_MAX_MINUTES,
  SINGLE_PROBLEM_MIN_MINUTES,
  clampDuration,
  getInterviewDifficultyOrder,
  getRecentAttemptCutoff,
  pickInterviewProblem,
  sortInterviewProblems,
  type InterviewProblemCandidate,
} from "@/lib/interviews/interviewRules";
import type {
  FocusedPatternInterviewOptions,
  GeneratedInterviewRound,
  GeneratedInterviewSession,
  InterviewGenerationOptions,
  InterviewProblemMetadata,
  InterviewRoundConfig,
  InterviewSessionConfig,
  MultiProblemInterviewOptions,
} from "@/lib/interviews/types";
import { getPrisma } from "@/lib/prisma";
import {
  buildWeaknessPatternInputs,
  calculatePatternWeaknessScores,
} from "@/lib/recommendations/weaknessScore";

type DbProblemForInterview = Awaited<ReturnType<typeof loadProblemBank>>[number];
type CreatedInterviewSessionRecord = Awaited<
  ReturnType<typeof createInterviewSessionRecord>
>;

const DEFAULT_STARTER_PATTERN_ID = "arrays-hashing";

function normalizeId(value: string | undefined): string {
  return value?.trim() ?? "";
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getPrimaryPatternId(problem: DbProblemForInterview): string | null {
  return (
    problem.problemPatterns.find((problemPattern) => problemPattern.isPrimary)
      ?.patternId ?? null
  );
}

function toCandidate(problem: DbProblemForInterview): InterviewProblemCandidate | null {
  const primaryPatternId = getPrimaryPatternId(problem);

  if (!primaryPatternId) {
    return null;
  }

  return {
    id: problem.id,
    title: problem.title,
    difficulty: problem.difficulty,
    estimatedMinutes: problem.estimatedMinutes,
    primaryPatternId,
    secondaryPatternIds: problem.problemPatterns
      .filter((problemPattern) => !problemPattern.isPrimary)
      .map((problemPattern) => problemPattern.patternId),
  };
}

function toProblemMetadata(problem: {
  id: string;
  title: string;
  url: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  recognitionClues: string[];
  commonMistakes: string[];
}): InterviewProblemMetadata {
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

function toGeneratedInterviewSession(
  session: CreatedInterviewSessionRecord,
): GeneratedInterviewSession {
  return {
    id: session.id,
    userProfileId: session.userProfileId,
    interviewType: session.interviewType,
    status: session.status,
    title: session.title,
    targetPatternId: session.targetPatternId,
    difficultyTarget: session.difficultyTarget,
    durationMinutes: session.durationMinutes,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    overallScore: session.overallScore,
    communicationScore: session.communicationScore,
    patternRecognitionScore: session.patternRecognitionScore,
    problemSolvingScore: session.problemSolvingScore,
    implementationScore: session.implementationScore,
    testingScore: session.testingScore,
    complexityScore: session.complexityScore,
    timeManagementScore: session.timeManagementScore,
    result: session.result,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    rounds: session.rounds.map(toGeneratedInterviewRound),
  };
}

function toGeneratedInterviewRound(
  round: CreatedInterviewSessionRecord["rounds"][number],
): GeneratedInterviewRound {
  return {
    id: round.id,
    interviewSessionId: round.interviewSessionId,
    problemId: round.problemId,
    roundNumber: round.roundNumber,
    status: round.status,
    startedAt: round.startedAt.toISOString(),
    completedAt: round.completedAt?.toISOString() ?? null,
    selectedPatternId: round.selectedPatternId,
    patternExplanation: round.patternExplanation,
    approachText: round.approachText,
    codeText: round.codeText,
    testCasesText: round.testCasesText,
    complexityText: round.complexityText,
    attemptId: round.attemptId,
    aiReviewId: round.aiReviewId,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
    problem: toProblemMetadata(round.problem),
  };
}

async function loadProblemBank() {
  return getPrisma().problem.findMany({
    include: {
      problemPatterns: true,
    },
    orderBy: [{ estimatedMinutes: "asc" }, { title: "asc" }],
  });
}

async function loadRecentProblemIds(
  userProfileId: string,
  now: Date,
  recentAttemptDays: number,
): Promise<Set<string>> {
  const cutoff = getRecentAttemptCutoff(now, recentAttemptDays);
  const attempts = await getPrisma().attempt.findMany({
    where: {
      userProfileId,
      createdAt: { gte: cutoff },
    },
    select: { problemId: true },
  });

  return new Set(attempts.map((attempt) => attempt.problemId));
}

async function loadFailedBattlePatternIds(userProfileId: string): Promise<string[]> {
  const battles = await getPrisma().battle.findMany({
    where: {
      userProfileId,
      status: "Completed",
      result: { in: ["Defeat", "PartialVictory"] },
    },
    select: {
      targetPatternId: true,
      completedAt: true,
      rounds: {
        select: {
          expectedPatternId: true,
        },
        orderBy: { roundNumber: "asc" },
      },
    },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    take: 5,
  });

  return unique(
    battles.flatMap((battle) => [
      battle.targetPatternId ?? "",
      ...battle.rounds.map((round) => round.expectedPatternId),
    ]),
  );
}

async function loadGenerationContext(
  userProfileId: string,
  options: InterviewGenerationOptions | FocusedPatternInterviewOptions = {},
) {
  const now = options.now ?? new Date();
  const recentAttemptDays =
    options.recentAttemptDays ?? DEFAULT_RECENT_ATTEMPT_DAYS;
  const [
    readinessReport,
    patternMetrics,
    confusions,
    problemBank,
    recentProblemIds,
    failedBattlePatternIds,
  ] = await Promise.all([
    getReadinessReport(userProfileId),
    getPatternMetrics(userProfileId, now),
    getPatternConfusions(userProfileId),
    loadProblemBank(),
    loadRecentProblemIds(userProfileId, now, recentAttemptDays),
    loadFailedBattlePatternIds(userProfileId),
  ]);
  const problemCandidates = problemBank
    .map(toCandidate)
    .filter((problem): problem is InterviewProblemCandidate => problem !== null);
  const problemsById = new Map(problemBank.map((problem) => [problem.id, problem]));
  const difficultyOrder = getInterviewDifficultyOrder(
    readinessReport.overallReadinessScore,
    options.difficultyTarget,
  );

  return {
    now,
    readinessReport,
    patternMetrics,
    confusions,
    problemBank,
    problemCandidates,
    problemsById,
    recentProblemIds,
    failedBattlePatternIds,
    difficultyOrder,
    difficultyTarget: options.difficultyTarget ?? difficultyOrder[0],
  };
}

function getWeakPatternIds(
  patternMetrics: PatternMetric[],
  confusions: Awaited<ReturnType<typeof getPatternConfusions>>,
): string[] {
  return calculatePatternWeaknessScores(
    buildWeaknessPatternInputs(patternMetrics, confusions),
  )
    .filter((weakness) => weakness.severity !== "Unstarted")
    .map((weakness) => weakness.patternId);
}

function getFallbackPatternId(patternMetrics: PatternMetric[]): string {
  return (
    patternMetrics
      .slice()
      .sort(
        (a, b) =>
          a.masteryScore - b.masteryScore ||
          b.attemptsCount - a.attemptsCount ||
          a.patternName.localeCompare(b.patternName),
      )[0]?.patternId ?? DEFAULT_STARTER_PATTERN_ID
  );
}

function getFocusedRoundCount(
  options: FocusedPatternInterviewOptions,
  availableProblemCount: number,
): 1 | 2 {
  if (options.roundCount) {
    return options.roundCount;
  }

  return availableProblemCount > 1 ? 2 : 1;
}

function makeRoundConfig(
  candidate: InterviewProblemCandidate,
  roundNumber: number,
): InterviewRoundConfig {
  return {
    problemId: candidate.id,
    correctPatternId: candidate.primaryPatternId,
    roundNumber,
  };
}

function selectProblemsForPatterns({
  patternIds,
  problemCandidates,
  recentProblemIds,
  difficultyOrder,
  roundCount,
  requireDistinctPrimaryPatterns = false,
}: {
  patternIds: string[];
  problemCandidates: InterviewProblemCandidate[];
  recentProblemIds: Set<string>;
  difficultyOrder: Difficulty[];
  roundCount: number;
  requireDistinctPrimaryPatterns?: boolean;
}): InterviewProblemCandidate[] {
  const usedProblemIds = new Set<string>();
  const usedPrimaryPatternIds = new Set<string>();
  const selected: InterviewProblemCandidate[] = [];

  for (const patternId of patternIds) {
    if (selected.length >= roundCount) {
      break;
    }

    const distinctProblemCandidates = requireDistinctPrimaryPatterns
      ? problemCandidates.filter(
          (problem) => !usedPrimaryPatternIds.has(problem.primaryPatternId),
        )
      : problemCandidates;
    const problem = pickInterviewProblem(
      distinctProblemCandidates.length > 0
        ? distinctProblemCandidates
        : problemCandidates,
      {
        patternId,
        includeSecondaryPatterns: true,
        difficultyOrder,
        recentProblemIds,
        usedProblemIds,
      },
    );

    if (!problem) {
      continue;
    }

    selected.push(problem);
    usedProblemIds.add(problem.id);
    usedPrimaryPatternIds.add(problem.primaryPatternId);
  }

  while (selected.length < roundCount) {
    const distinctProblemCandidates = requireDistinctPrimaryPatterns
      ? problemCandidates.filter(
          (problem) => !usedPrimaryPatternIds.has(problem.primaryPatternId),
        )
      : problemCandidates;
    const fallback = pickInterviewProblem(
      distinctProblemCandidates.length > 0
        ? distinctProblemCandidates
        : problemCandidates,
      {
        difficultyOrder,
        recentProblemIds,
        usedProblemIds,
      },
    );

    if (!fallback) {
      break;
    }

    selected.push(fallback);
    usedProblemIds.add(fallback.id);
    usedPrimaryPatternIds.add(fallback.primaryPatternId);

    if (usedProblemIds.size >= problemCandidates.length) {
      break;
    }
  }

  return selected;
}

async function createInterviewSessionRecord(
  userProfileId: string,
  config: InterviewSessionConfig,
) {
  if (!normalizeId(userProfileId)) {
    throw new Error("User profile ID is required.");
  }

  if (config.rounds.length === 0) {
    throw new Error("Interview must include at least one round.");
  }

  return getPrisma().interviewSession.create({
    data: {
      userProfileId,
      interviewType: config.interviewType,
      title: config.title,
      targetPatternId: config.targetPatternId,
      difficultyTarget: config.difficultyTarget,
      durationMinutes: config.durationMinutes,
      ...(config.startedAt ? { startedAt: config.startedAt } : {}),
      rounds: {
        create: config.rounds.map((round, index) => ({
          problemId: round.problemId,
          roundNumber: round.roundNumber ?? index + 1,
          status: index === 0 ? "Active" : "Pending",
          correctPatternId: round.correctPatternId,
          ...(config.startedAt ? { startedAt: config.startedAt } : {}),
        })),
      },
    },
    include: {
      rounds: {
        include: {
          problem: true,
        },
        orderBy: { roundNumber: "asc" },
      },
    },
  });
}

export async function createInterviewSessionFromRounds(
  userProfileId: string,
  config: InterviewSessionConfig,
): Promise<GeneratedInterviewSession> {
  return toGeneratedInterviewSession(
    await createInterviewSessionRecord(userProfileId, config),
  );
}

export async function generateSingleProblemInterview(
  userProfileId: string,
  options: InterviewGenerationOptions = {},
): Promise<GeneratedInterviewSession> {
  const context = await loadGenerationContext(userProfileId, options);
  const recommendedPatternId =
    context.readinessReport.weakestPatterns[0]?.patternId ??
    context.readinessReport.patternsNeedingReview[0]?.patternId ??
    getFallbackPatternId(context.patternMetrics);
  const selectedProblem = options.problemId
    ? context.problemCandidates.find(
        (problem) => problem.id === normalizeId(options.problemId),
      )
    : pickInterviewProblem(context.problemCandidates, {
        patternId: recommendedPatternId,
        includeSecondaryPatterns: true,
        difficultyOrder: context.difficultyOrder,
        recentProblemIds: context.recentProblemIds,
      }) ??
      sortInterviewProblems(context.problemCandidates, {
        difficultyOrder: context.difficultyOrder,
        recentProblemIds: context.recentProblemIds,
      })[0];

  if (!selectedProblem) {
    throw new Error("No interview problem is available.");
  }

  return createInterviewSessionFromRounds(userProfileId, {
    interviewType: "SingleProblem",
    title: options.title ?? `Single Problem Interview: ${selectedProblem.title}`,
    targetPatternId: selectedProblem.primaryPatternId,
    difficultyTarget: context.difficultyTarget,
    durationMinutes: clampDuration(
      options.durationMinutes,
      DEFAULT_SINGLE_PROBLEM_MINUTES,
      {
        min: SINGLE_PROBLEM_MIN_MINUTES,
        max: SINGLE_PROBLEM_MAX_MINUTES,
      },
    ),
    startedAt: context.now,
    rounds: [makeRoundConfig(selectedProblem, 1)],
  });
}

export async function generateFocusedPatternInterview(
  userProfileId: string,
  patternId: string,
  options: FocusedPatternInterviewOptions = {},
): Promise<GeneratedInterviewSession> {
  const scopedPatternId = normalizeId(patternId);
  const context = await loadGenerationContext(userProfileId, options);
  const targetPatternId =
    scopedPatternId || getWeakPatternIds(context.patternMetrics, context.confusions)[0] ||
    getFallbackPatternId(context.patternMetrics);
  const availableProblemCount = context.problemCandidates.filter(
    (problem) =>
      problem.primaryPatternId === targetPatternId ||
      problem.secondaryPatternIds.includes(targetPatternId),
  ).length;
  const roundCount = getFocusedRoundCount(options, availableProblemCount);
  const selectedProblems = selectProblemsForPatterns({
    patternIds: Array(roundCount).fill(targetPatternId),
    problemCandidates: context.problemCandidates,
    recentProblemIds: context.recentProblemIds,
    difficultyOrder: context.difficultyOrder,
    roundCount,
    requireDistinctPrimaryPatterns: true,
  });

  if (selectedProblems.length === 0) {
    throw new Error("No focused interview problem is available.");
  }

  return createInterviewSessionFromRounds(userProfileId, {
    interviewType: "FocusedPattern",
    title: options.title ?? "Focused Pattern Interview",
    targetPatternId,
    difficultyTarget: context.difficultyTarget,
    durationMinutes: clampDuration(
      options.durationMinutes,
      DEFAULT_FOCUSED_PATTERN_MINUTES,
    ),
    startedAt: context.now,
    rounds: selectedProblems.map((problem, index) =>
      makeRoundConfig(problem, index + 1),
    ),
  });
}

export async function generateMixedInterview(
  userProfileId: string,
  options: MultiProblemInterviewOptions = {},
): Promise<GeneratedInterviewSession> {
  const context = await loadGenerationContext(userProfileId, options);
  const roundCount = options.roundCount ?? 2;
  const activePatterns = context.patternMetrics.filter(
    (patternMetric) => patternMetric.attemptsCount > 0,
  );
  const weakPatternIds = getWeakPatternIds(
    context.patternMetrics,
    context.confusions,
  );
  const strongPatternIds = activePatterns
    .slice()
    .sort(
      (a, b) =>
        b.masteryScore - a.masteryScore ||
        b.recognitionAccuracy - a.recognitionAccuracy ||
        a.patternName.localeCompare(b.patternName),
    )
    .map((patternMetric) => patternMetric.patternId);
  const patternIds = unique([
    weakPatternIds[0] ?? getFallbackPatternId(context.patternMetrics),
    ...strongPatternIds,
    ...context.patternMetrics.map((patternMetric) => patternMetric.patternId),
  ]);
  const selectedProblems = selectProblemsForPatterns({
    patternIds,
    problemCandidates: context.problemCandidates,
    recentProblemIds: context.recentProblemIds,
    difficultyOrder: context.difficultyOrder,
    roundCount,
  });

  if (selectedProblems.length === 0) {
    throw new Error("No mixed interview problem is available.");
  }

  return createInterviewSessionFromRounds(userProfileId, {
    interviewType: "MixedInterview",
    title: options.title ?? "Mixed Interview",
    difficultyTarget: context.difficultyTarget,
    durationMinutes: clampDuration(
      options.durationMinutes,
      DEFAULT_MIXED_INTERVIEW_MINUTES,
    ),
    startedAt: context.now,
    rounds: selectedProblems.map((problem, index) =>
      makeRoundConfig(problem, index + 1),
    ),
  });
}

export async function generateWeaknessRepairInterview(
  userProfileId: string,
  options: MultiProblemInterviewOptions = {},
): Promise<GeneratedInterviewSession> {
  const context = await loadGenerationContext(userProfileId, options);
  const roundCount = options.roundCount ?? 2;
  const weakPatternIds = getWeakPatternIds(
    context.patternMetrics,
    context.confusions,
  );
  const confusionPatternIds = context.confusions.flatMap((confusion) => [
    confusion.correctPatternId,
    confusion.selectedPatternId,
  ]);
  const patternIds = unique([
    ...context.failedBattlePatternIds,
    ...confusionPatternIds,
    ...weakPatternIds,
    getFallbackPatternId(context.patternMetrics),
  ]);
  const selectedProblems = selectProblemsForPatterns({
    patternIds,
    problemCandidates: context.problemCandidates,
    recentProblemIds: context.recentProblemIds,
    difficultyOrder: context.difficultyOrder,
    roundCount,
  });

  if (selectedProblems.length === 0) {
    throw new Error("No weakness repair interview problem is available.");
  }

  return createInterviewSessionFromRounds(userProfileId, {
    interviewType: "WeaknessRepair",
    title: options.title ?? "Weakness Repair Interview",
    targetPatternId: patternIds[0],
    difficultyTarget: context.difficultyTarget,
    durationMinutes: clampDuration(
      options.durationMinutes,
      DEFAULT_WEAKNESS_REPAIR_MINUTES,
    ),
    startedAt: context.now,
    rounds: selectedProblems.map((problem, index) =>
      makeRoundConfig(problem, index + 1),
    ),
  });
}

export type { InterviewSessionConfig };
