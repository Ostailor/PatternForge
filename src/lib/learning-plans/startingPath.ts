import "server-only";

import { CurrentLevel, PreferredSessionLength } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { getPatternById } from "@/data/patterns";
import { problems } from "@/data/problems";

export const STARTING_PATH_TITLE = "Your starting path";

const HIGH_VALUE_PATTERN_IDS = [
  "arrays-hashing",
  "two-pointers",
  "sliding-window",
  "stack",
  "binary-search",
] as const;

type StartingPathSettings = {
  currentLevel: CurrentLevel;
  preferredSessionLength: PreferredSessionLength;
  dailyGoalMinutes: number;
};

type DiagnosticSignal = {
  weakPatternId: string | null;
  confusedSelectedPatternId: string | null;
  confusedCorrectPatternId: string | null;
  recommendedStartPatternId: string | null;
};

type StartingPathStepDraft = {
  dayIndex: number;
  stepType: string;
  title: string;
  targetPatternId?: string;
  problemId?: string;
  targetCount?: number;
};

type StartingPathDraft = {
  title: string;
  goal: string;
  steps: StartingPathStepDraft[];
};

type EnsureStartingPathInput = {
  client: Prisma.TransactionClient;
  userProfileId: string;
  diagnosticAssessmentId?: string;
  refreshExisting?: boolean;
};

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function getSessionLabel(settings: StartingPathSettings): string {
  switch (settings.preferredSessionLength) {
    case PreferredSessionLength.Short10:
      return "short 10-minute";
    case PreferredSessionLength.Long45:
      return "long 45-minute";
    case PreferredSessionLength.Medium25:
      return settings.dailyGoalMinutes <= 10 ? "short 10-minute" : "medium 25-minute";
  }
}

function getProblemForPattern(patternId: string | undefined) {
  return (
    problems
      .filter((problem) => problem.primaryPatternId === patternId)
      .sort(
        (left, right) =>
          left.estimatedMinutes - right.estimatedMinutes ||
          left.difficulty.localeCompare(right.difficulty) ||
          left.title.localeCompare(right.title),
      )[0] ?? problems[0]
  );
}

function getMixedProblem(dayIndex: number) {
  return problems
    .slice()
    .sort(
      (left, right) =>
        left.difficulty.localeCompare(right.difficulty) ||
        left.estimatedMinutes - right.estimatedMinutes ||
        left.title.localeCompare(right.title),
    )[dayIndex % problems.length];
}

function getPatternName(patternId: string | null | undefined): string {
  return getPatternById(patternId ?? "")?.name ?? "core patterns";
}

function chooseWeakHighValuePattern(signal: DiagnosticSignal): string {
  if (
    signal.weakPatternId &&
    HIGH_VALUE_PATTERN_IDS.includes(
      signal.weakPatternId as (typeof HIGH_VALUE_PATTERN_IDS)[number],
    )
  ) {
    return signal.weakPatternId;
  }

  return signal.recommendedStartPatternId ?? HIGH_VALUE_PATTERN_IDS[0];
}

function buildGoal({
  level,
  reason,
}: {
  level: CurrentLevel;
  reason: string;
}): string {
  return `Why this plan was chosen: ${reason} Estimated level: ${level}. The path stays explainable by pairing each day with one clear practice intent.`;
}

function buildBeginnerPath(settings: StartingPathSettings): StartingPathDraft {
  const sessionLabel = getSessionLabel(settings);
  const sequence = ["arrays-hashing", "two-pointers", "sliding-window"];

  return {
    title: STARTING_PATH_TITLE,
    goal: buildGoal({
      level: CurrentLevel.Beginner,
      reason: `Beginner setup starts with Arrays & Hashing, then Two Pointers, then Sliding Window using ${sessionLabel} sessions.`,
    }),
    steps: [
      {
        dayIndex: 0,
        stepType: "FocusProblem",
        title: "Arrays & Hashing foundation",
        targetPatternId: sequence[0],
        problemId: getProblemForPattern(sequence[0]).id,
        targetCount: 1,
      },
      {
        dayIndex: 1,
        stepType: "Review",
        title: "Warm up yesterday's recognition cues",
        targetPatternId: sequence[0],
        targetCount: sessionLabel.startsWith("short") ? 3 : 5,
      },
      {
        dayIndex: 2,
        stepType: "FocusProblem",
        title: "Two Pointers first pass",
        targetPatternId: sequence[1],
        problemId: getProblemForPattern(sequence[1]).id,
        targetCount: 1,
      },
      {
        dayIndex: 3,
        stepType: "DailyForge",
        title: "Daily Forge: Arrays & Hashing checkpoint",
        targetPatternId: sequence[0],
        targetCount: 1,
      },
      {
        dayIndex: 4,
        stepType: "FocusProblem",
        title: "Sliding Window first pass",
        targetPatternId: sequence[2],
        problemId: getProblemForPattern(sequence[2]).id,
        targetCount: 1,
      },
      {
        dayIndex: 5,
        stepType: "Review",
        title: "Review the three starter pattern cues",
        targetPatternId: sequence[2],
        targetCount: sessionLabel.startsWith("short") ? 3 : 6,
      },
      {
        dayIndex: 6,
        stepType: "MixedProblem",
        title: "Starter mixed recognition practice",
        problemId: getMixedProblem(6).id,
        targetCount: 1,
      },
    ],
  };
}

function buildSomeExperiencePath(
  settings: StartingPathSettings,
  signal: DiagnosticSignal,
): StartingPathDraft {
  const weakPatternId = signal.weakPatternId ?? signal.recommendedStartPatternId ?? "arrays-hashing";
  const hasConfusion =
    Boolean(signal.confusedSelectedPatternId) &&
    Boolean(signal.confusedCorrectPatternId) &&
    signal.confusedSelectedPatternId !== signal.confusedCorrectPatternId;
  const contrastTitle = hasConfusion
    ? `${getPatternName(signal.confusedSelectedPatternId)} vs ${getPatternName(
        signal.confusedCorrectPatternId,
      )}`
    : `${getPatternName(weakPatternId)} recognition contrast`;

  return {
    title: STARTING_PATH_TITLE,
    goal: buildGoal({
      level: CurrentLevel.SomeExperience,
      reason: `Some experience setup starts with the diagnostic weak pattern, ${getPatternName(
        weakPatternId,
      )}, and includes review warmups${
        hasConfusion ? " plus one contrast drill for the detected confusion" : ""
      }. Session length is ${getSessionLabel(settings)}.`,
    }),
    steps: [
      {
        dayIndex: 0,
        stepType: "Review",
        title: `${getPatternName(weakPatternId)} recognition warmup`,
        targetPatternId: weakPatternId,
        targetCount: 4,
      },
      {
        dayIndex: 1,
        stepType: "FocusProblem",
        title: `${getPatternName(weakPatternId)} focused problem`,
        targetPatternId: weakPatternId,
        problemId: getProblemForPattern(weakPatternId).id,
        targetCount: 1,
      },
      {
        dayIndex: 2,
        stepType: hasConfusion ? "ContrastDrill" : "DailyForge",
        title: contrastTitle,
        targetPatternId: signal.confusedCorrectPatternId ?? weakPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 3,
        stepType: "Review",
        title: "Review missed recognition signals",
        targetPatternId: weakPatternId,
        targetCount: 5,
      },
      {
        dayIndex: 4,
        stepType: "FocusProblem",
        title: `${getPatternName(weakPatternId)} second rep`,
        targetPatternId: weakPatternId,
        problemId: getProblemForPattern(weakPatternId).id,
        targetCount: 1,
      },
      {
        dayIndex: 5,
        stepType: "MixedProblem",
        title: "Mixed pattern check",
        problemId: getMixedProblem(5).id,
        targetCount: 1,
      },
      {
        dayIndex: 6,
        stepType: "Reflection",
        title: "Update your pattern notes",
        targetPatternId: weakPatternId,
        targetCount: 1,
      },
    ],
  };
}

function buildInterviewPrepPath(
  settings: StartingPathSettings,
  signal: DiagnosticSignal,
): StartingPathDraft {
  const targetPatternId = chooseWeakHighValuePattern(signal);

  return {
    title: STARTING_PATH_TITLE,
    goal: buildGoal({
      level: CurrentLevel.InterviewPrep,
      reason: `Interview prep setup starts with the weakest high-value pattern, ${getPatternName(
        targetPatternId,
      )}, then moves from Daily Forge and review into Interview Mode after several attempts. Session length is ${getSessionLabel(
        settings,
      )}.`,
    }),
    steps: [
      {
        dayIndex: 0,
        stepType: "DailyForge",
        title: `Daily Forge: ${getPatternName(targetPatternId)}`,
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 1,
        stepType: "FocusProblem",
        title: `${getPatternName(targetPatternId)} implementation rep`,
        targetPatternId,
        problemId: getProblemForPattern(targetPatternId).id,
        targetCount: 1,
      },
      {
        dayIndex: 2,
        stepType: "Review",
        title: "Review missed cues before mixed practice",
        targetPatternId,
        targetCount: 6,
      },
      {
        dayIndex: 3,
        stepType: "MixedProblem",
        title: "Mixed high-value pattern practice",
        problemId: getMixedProblem(3).id,
        targetCount: 1,
      },
      {
        dayIndex: 4,
        stepType: "DailyForge",
        title: "Daily Forge checkpoint",
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 5,
        stepType: "MockInterview",
        title: "Interview Mode baseline",
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 6,
        stepType: "Review",
        title: "Review interview follow-ups",
        targetPatternId,
        targetCount: 5,
      },
    ],
  };
}

function buildAdvancedPath(
  settings: StartingPathSettings,
  signal: DiagnosticSignal,
): StartingPathDraft {
  const targetPatternId = signal.recommendedStartPatternId ?? "sliding-window";

  return {
    title: STARTING_PATH_TITLE,
    goal: buildGoal({
      level: CurrentLevel.Advanced,
      reason: `Advanced setup starts with mixed practice and schedules a Boss Battle or Mock Interview after the baseline diagnostic. Session length is ${getSessionLabel(
        settings,
      )}.`,
    }),
    steps: [
      {
        dayIndex: 0,
        stepType: "MixedProblem",
        title: "Mixed practice baseline",
        problemId: getMixedProblem(0).id,
        targetCount: 1,
      },
      {
        dayIndex: 1,
        stepType: "DailyForge",
        title: "Daily Forge: weakest signal",
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 2,
        stepType: "Review",
        title: "Review diagnostic misses",
        targetPatternId,
        targetCount: 5,
      },
      {
        dayIndex: 3,
        stepType: "MixedProblem",
        title: "Mixed practice under time pressure",
        problemId: getMixedProblem(3).id,
        targetCount: 1,
      },
      {
        dayIndex: 4,
        stepType: "BossBattle",
        title: `${getPatternName(targetPatternId)} boss battle`,
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 5,
        stepType: "MockInterview",
        title: "Mock interview calibration",
        targetPatternId,
        targetCount: 1,
      },
      {
        dayIndex: 6,
        stepType: "Reflection",
        title: "Choose next advanced focus",
        targetPatternId,
        targetCount: 1,
      },
    ],
  };
}

async function loadSettings(
  client: Prisma.TransactionClient,
  userProfileId: string,
): Promise<StartingPathSettings> {
  const settings = await client.userSettings.findUnique({
    where: { userProfileId },
    select: {
      currentLevel: true,
      preferredSessionLength: true,
      dailyGoalMinutes: true,
    },
  });

  return {
    currentLevel: settings?.currentLevel ?? CurrentLevel.Beginner,
    preferredSessionLength:
      settings?.preferredSessionLength ?? PreferredSessionLength.Medium25,
    dailyGoalMinutes: settings?.dailyGoalMinutes ?? 25,
  };
}

async function loadDiagnosticSignal(
  client: Prisma.TransactionClient,
  userProfileId: string,
  diagnosticAssessmentId?: string,
): Promise<DiagnosticSignal> {
  const assessment = await client.diagnosticAssessment.findFirst({
    where: {
      userProfileId,
      status: "Completed",
      ...(diagnosticAssessmentId ? { id: diagnosticAssessmentId } : {}),
    },
    include: {
      questions: {
        where: {
          questionType: "PatternRecognition",
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { completedAt: "desc" },
  });
  const firstMiss = assessment?.questions.find(
    (question) => question.wasCorrect === false,
  );

  return {
    weakPatternId: firstMiss?.correctAnswer ?? null,
    confusedSelectedPatternId: firstMiss?.selectedAnswer ?? null,
    confusedCorrectPatternId: firstMiss?.correctAnswer ?? null,
    recommendedStartPatternId: assessment?.recommendedStartPatternId ?? null,
  };
}

function buildStartingPath(
  settings: StartingPathSettings,
  signal: DiagnosticSignal,
): StartingPathDraft {
  switch (settings.currentLevel) {
    case CurrentLevel.SomeExperience:
      return buildSomeExperiencePath(settings, signal);
    case CurrentLevel.InterviewPrep:
      return buildInterviewPrepPath(settings, signal);
    case CurrentLevel.Advanced:
      return buildAdvancedPath(settings, signal);
    case CurrentLevel.Beginner:
      return buildBeginnerPath(settings);
  }
}

export async function ensureStartingPathForUser({
  client,
  userProfileId,
  diagnosticAssessmentId,
  refreshExisting = false,
}: EnsureStartingPathInput): Promise<{ planId: string; created: boolean }> {
  const existingPlan = await client.learningPlan.findFirst({
    where: {
      userProfileId,
      title: STARTING_PATH_TITLE,
      status: "Active",
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (existingPlan && !refreshExisting) {
    return { planId: existingPlan.id, created: false };
  }

  const [settings, signal] = await Promise.all([
    loadSettings(client, userProfileId),
    loadDiagnosticSignal(client, userProfileId, diagnosticAssessmentId),
  ]);
  const draft = buildStartingPath(settings, signal);
  const startDate = new Date();
  const planData = {
    title: draft.title,
    goal: draft.goal,
    status: "Active" as const,
    startDate,
    endDate: addDays(startDate, 6),
  };

  if (existingPlan) {
    await client.learningPlanStep.deleteMany({
      where: { learningPlanId: existingPlan.id },
    });
    await client.learningPlan.update({
      where: { id: existingPlan.id },
      data: {
        ...planData,
        steps: {
          create: draft.steps.map((step) => ({
            dayIndex: step.dayIndex,
            stepType: step.stepType,
            title: step.title,
            targetPatternId: step.targetPatternId,
            problemId: step.problemId,
            targetCount: step.targetCount,
            status: step.dayIndex === 0 ? "Active" : "Pending",
            dueDate: addDays(startDate, step.dayIndex),
          })),
        },
      },
    });

    return { planId: existingPlan.id, created: false };
  }

  const plan = await client.learningPlan.create({
    data: {
      userProfileId,
      ...planData,
      steps: {
        create: draft.steps.map((step) => ({
          dayIndex: step.dayIndex,
          stepType: step.stepType,
          title: step.title,
          targetPatternId: step.targetPatternId,
          problemId: step.problemId,
          targetCount: step.targetCount,
          status: step.dayIndex === 0 ? "Active" : "Pending",
          dueDate: addDays(startDate, step.dayIndex),
        })),
      },
    },
    select: { id: true },
  });

  return { planId: plan.id, created: true };
}
