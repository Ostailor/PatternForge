"use server";

import { revalidatePath } from "next/cache";

import {
  CodeLanguage,
  CodeRunStatus,
  CodeRunType,
  CodeSubmissionStatus,
  TestCaseSource,
  type Prisma,
} from "@/generated/prisma/client";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import {
  requestDebugCoach,
  type DebugCoachOutput,
} from "@/lib/ai/debugCoach";
import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import { getCodeExecutionUnavailableMessage } from "@/lib/code-runner/executor";
import { runCode } from "@/lib/code-runner/runner";
import {
  getRunnerConfig,
  validateTestInputAgainstSchema,
  validateTestOutputAgainstSchema,
} from "@/lib/code-runner/runnerConfig";
import {
  MAX_CODE_LENGTH,
  MAX_TEST_EXPECTED_OUTPUT_SIZE,
  MAX_TEST_INPUT_SIZE,
  MAX_TESTS_PER_RUN,
} from "@/lib/code-runner/limits";
import type { CodeRunResult, CodeRunnerTestCase } from "@/lib/code-runner/types";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit/rateLimit";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

export type WorkspaceMode = "Practice" | "Interview" | "Battle";

export type WorkspaceContextInput = {
  problemId: string;
  attemptId?: string;
  interviewRoundId?: string;
  battleRoundId?: string;
};

export type WorkspaceSubmissionHistoryItem = {
  id: string;
  language: "Python";
  status: string;
  createdAt: string;
  updatedAt: string;
  runCount: number;
  latestRunStatus: string | null;
};

export type WorkspaceTestCaseItem = {
  id: string;
  source: "User" | "PatternForge";
  name: string;
  inputJson: unknown;
  expectedOutputJson: unknown;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceRunActionInput = WorkspaceContextInput & {
  codeSubmissionId?: string;
  language: "Python";
  code: string;
  tests: CodeRunnerTestCase[];
  runType: "CustomTests" | "FreeRun";
};

export type WorkspaceRunActionResult =
  | {
      status: "completed";
      result: CodeRunResult;
      codeRunId: string;
      codeSubmissionId: string;
      historyItem: WorkspaceSubmissionHistoryItem;
    }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid"; message: string };

export type SaveCodeSubmissionActionInput = WorkspaceContextInput & {
  codeSubmissionId?: string;
  language: "Python";
  code: string;
};

export type SaveCodeSubmissionActionResult =
  | {
      status: "saved";
      historyItem: WorkspaceSubmissionHistoryItem;
      message: string;
    }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid"; message: string };

export type SaveWorkspaceTestCasesInput = WorkspaceContextInput & {
  tests: {
    id?: string;
    name: string;
    inputJson: unknown;
    expectedOutputJson: unknown;
  }[];
};

export type SaveWorkspaceTestCasesActionResult =
  | {
      status: "saved";
      tests: WorkspaceTestCaseItem[];
      message: string;
    }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid"; message: string };

export type DebugInsightView = {
  id: string;
  summary: string;
  likelyCause: string;
  suggestedFix: string;
  followUpQuestion: string | null;
  suggestedTestCase?: DebugCoachOutput["suggestedTestCase"];
  suggestedFlashcard?: DebugCoachOutput["suggestedFlashcard"];
  suggestedMistake?: DebugCoachOutput["suggestedMistake"];
  createdAt: string;
};

export type CreateDebugInsightActionResult =
  | { status: "created"; insight: DebugInsightView }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid"; message: string };

export type CreateDebugStudyCardActionResult =
  | { status: "created"; message: string }
  | { status: "unauthenticated"; message: string }
  | { status: "invalid"; message: string };

type LinkedContext = {
  attemptId?: string;
  interviewRoundId?: string;
  battleRoundId?: string;
};

type OwnedSubmission = {
  id: string;
  userProfileId: string;
  problemId: string;
  attemptId: string | null;
  interviewRoundId: string | null;
  battleRoundId: string | null;
};

function readNonEmpty(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value);

  if (serialized === undefined) {
    throw new Error("Value must be valid JSON.");
  }

  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function toNullableJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : toJsonValue(value);
}

function serializedSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function validateCodePayload(code: string): string | null {
  if (typeof code !== "string") {
    return "Code must be text.";
  }

  if (!code.trim()) {
    return "Code is required before saving.";
  }

  if (code.length > MAX_CODE_LENGTH) {
    return `Code must be ${MAX_CODE_LENGTH.toLocaleString()} characters or fewer.`;
  }

  return null;
}

function isWorkspaceRunType(value: unknown): value is "CustomTests" | "FreeRun" {
  return value === "CustomTests" || value === "FreeRun";
}

function toHistoryItem(submission: {
  id: string;
  language: CodeLanguage;
  status: CodeSubmissionStatus;
  createdAt: Date;
  updatedAt: Date;
  codeRuns: { status: CodeRunStatus; createdAt: Date }[];
}): WorkspaceSubmissionHistoryItem {
  const latestRun = submission.codeRuns
    .slice()
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];

  return {
    id: submission.id,
    language: "Python",
    status: submission.status,
    createdAt: submission.createdAt.toISOString(),
    updatedAt: submission.updatedAt.toISOString(),
    runCount: submission.codeRuns.length,
    latestRunStatus: latestRun?.status ?? null,
  };
}

function toWorkspaceTestCaseItem(testCase: {
  id: string;
  source: TestCaseSource;
  name: string;
  inputJson: Prisma.JsonValue;
  expectedOutputJson: Prisma.JsonValue;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceTestCaseItem {
  return {
    id: testCase.id,
    source: testCase.source,
    name: testCase.name,
    inputJson: testCase.inputJson,
    expectedOutputJson: testCase.expectedOutputJson,
    isPublic: testCase.isPublic,
    createdAt: testCase.createdAt.toISOString(),
    updatedAt: testCase.updatedAt.toISOString(),
  };
}

function sameOptionalId(left: string | null, right: string | undefined) {
  return (left ?? undefined) === right;
}

function submissionMatchesContext(
  submission: OwnedSubmission,
  context: LinkedContext,
) {
  return (
    sameOptionalId(submission.attemptId, context.attemptId) &&
    sameOptionalId(submission.interviewRoundId, context.interviewRoundId) &&
    sameOptionalId(submission.battleRoundId, context.battleRoundId)
  );
}

async function validateWorkspaceContext({
  userProfileId,
  input,
}: {
  userProfileId: string;
  input: WorkspaceContextInput;
}): Promise<
  | { ok: true; context: LinkedContext }
  | { ok: false; message: string }
> {
  if (typeof input.problemId !== "string" || !input.problemId.trim()) {
    return { ok: false, message: "Problem context is invalid." };
  }

  const problem = await getPrisma().problem.findUnique({
    where: {
      id: input.problemId,
    },
    select: {
      id: true,
    },
  });

  if (!problem) {
    return { ok: false, message: "Problem is not available in PatternForge." };
  }

  const context: LinkedContext = {};
  const attemptId = readNonEmpty(input.attemptId);
  const interviewRoundId = readNonEmpty(input.interviewRoundId);
  const battleRoundId = readNonEmpty(input.battleRoundId);

  if (attemptId) {
    const attempt = await getPrisma().attempt.findFirst({
      where: {
        id: attemptId,
        userProfileId,
        problemId: input.problemId,
      },
      select: {
        id: true,
      },
    });

    if (!attempt) {
      return { ok: false, message: "Attempt context is not available." };
    }

    context.attemptId = attempt.id;
  }

  if (interviewRoundId) {
    const round = await getPrisma().interviewRound.findFirst({
      where: {
        id: interviewRoundId,
        problemId: input.problemId,
        interviewSession: {
          userProfileId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!round) {
      return { ok: false, message: "Interview round context is not available." };
    }

    context.interviewRoundId = round.id;
  }

  if (battleRoundId) {
    const round = await getPrisma().battleRound.findFirst({
      where: {
        id: battleRoundId,
        problemId: input.problemId,
        battle: {
          userProfileId,
        },
      },
      select: {
        id: true,
      },
    });

    if (!round) {
      return { ok: false, message: "Battle round context is not available." };
    }

    context.battleRoundId = round.id;
  }

  return { ok: true, context };
}

function toDebugInsightView(
  insight: {
    id: string;
    summary: string;
    likelyCause: string;
    suggestedFix: string;
    followUpQuestion: string | null;
    createdAt: Date;
  },
  output?: DebugCoachOutput,
): DebugInsightView {
  return {
    id: insight.id,
    summary: insight.summary,
    likelyCause: insight.likelyCause,
    suggestedFix: insight.suggestedFix,
    followUpQuestion: insight.followUpQuestion,
    ...(output?.suggestedTestCase
      ? { suggestedTestCase: output.suggestedTestCase }
      : {}),
    ...(output?.suggestedFlashcard
      ? { suggestedFlashcard: output.suggestedFlashcard }
      : {}),
    ...(output?.suggestedMistake
      ? { suggestedMistake: output.suggestedMistake }
      : {}),
    createdAt: insight.createdAt.toISOString(),
  };
}

function validateWorkspaceTestPayload(
  tests: SaveWorkspaceTestCasesInput["tests"],
): string | null {
  if (!Array.isArray(tests)) {
    return "Custom tests must be provided as a list.";
  }

  if (tests.length === 0) {
    return "Add at least one custom test before saving.";
  }

  if (tests.length > MAX_TESTS_PER_RUN) {
    return `Save at most ${MAX_TESTS_PER_RUN} custom tests at a time.`;
  }

  for (const [index, test] of tests.entries()) {
    if (typeof test.name !== "string" || !test.name.trim()) {
      return `Test ${index + 1} needs a name.`;
    }

    if (
      JSON.stringify(test.inputJson) === undefined ||
      JSON.stringify(test.expectedOutputJson) === undefined
    ) {
      return `Test ${index + 1} input and expected output must be valid JSON.`;
    }

    if (serializedSize(test.inputJson) > MAX_TEST_INPUT_SIZE) {
      return `Test ${index + 1} input must be ${MAX_TEST_INPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`;
    }

    if (serializedSize(test.expectedOutputJson) > MAX_TEST_EXPECTED_OUTPUT_SIZE) {
      return `Test ${index + 1} expected output must be ${MAX_TEST_EXPECTED_OUTPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`;
    }
  }

  return null;
}

async function getReusableSubmission({
  codeSubmissionId,
  userProfileId,
  problemId,
  context,
}: {
  codeSubmissionId?: string;
  userProfileId: string;
  problemId: string;
  context: LinkedContext;
}): Promise<
  | { ok: true; submission: OwnedSubmission | null }
  | { ok: false; message: string }
> {
  const submissionId = readNonEmpty(codeSubmissionId);

  if (!submissionId) {
    return { ok: true, submission: null };
  }

  const submission = await getPrisma().codeSubmission.findFirst({
    where: {
      id: submissionId,
      userProfileId,
      problemId,
    },
    select: {
      id: true,
      userProfileId: true,
      problemId: true,
      attemptId: true,
      interviewRoundId: true,
      battleRoundId: true,
    },
  });

  if (!submission) {
    return {
      ok: false,
      message: "Code submission is not available for the current user.",
    };
  }

  if (!submissionMatchesContext(submission, context)) {
    return {
      ok: false,
      message: "Code submission context does not match this workspace.",
    };
  }

  return { ok: true, submission };
}

async function validateRunnableTests({
  userProfileId,
  problemId,
  tests,
}: {
  userProfileId: string;
  problemId: string;
  tests: CodeRunnerTestCase[];
}): Promise<
  | { ok: true; tests: CodeRunnerTestCase[] }
  | { ok: false; message: string }
> {
  if (!Array.isArray(tests)) {
    return { ok: false, message: "Tests must be provided as a list." };
  }

  const testCaseIds = tests.reduce<string[]>((ids, test) => {
    const testCaseId = readNonEmpty(test.testCaseId);

    return testCaseId ? [...ids, testCaseId] : ids;
  }, []);

  if (testCaseIds.length === 0) {
    return { ok: true, tests };
  }

  const uniqueIds = [...new Set(testCaseIds)];
  const allowedRows = await getPrisma().testCase.findMany({
    where: {
      id: {
        in: uniqueIds,
      },
      problemId,
      OR: [
        {
          source: TestCaseSource.User,
          userProfileId,
        },
        {
          source: TestCaseSource.PatternForge,
          isPublic: true,
        },
      ],
    },
    select: {
      id: true,
    },
  });
  const allowedIds = new Set(allowedRows.map((row) => row.id));
  const blockedId = uniqueIds.find((id) => !allowedIds.has(id));

  if (blockedId) {
    return {
      ok: false,
      message: "One selected test is not available for the current user.",
    };
  }

  return {
    ok: true,
    tests: tests.map((test) => ({
      ...test,
      testCaseId: test.testCaseId ? test.testCaseId : undefined,
    })),
  };
}

async function saveOrUpdateSubmission({
  codeSubmissionId,
  userProfileId,
  problemId,
  context,
  code,
  status,
}: {
  codeSubmissionId?: string;
  userProfileId: string;
  problemId: string;
  context: LinkedContext;
  code: string;
  status: CodeSubmissionStatus;
}) {
  const reusableSubmission = await getReusableSubmission({
    codeSubmissionId,
    userProfileId,
    problemId,
    context,
  });

  if (!reusableSubmission.ok) {
    return reusableSubmission;
  }

  const submission = reusableSubmission.submission
    ? await getPrisma().codeSubmission.update({
        where: {
          id: reusableSubmission.submission.id,
        },
        data: {
          language: CodeLanguage.Python,
          code,
          status,
        },
        include: {
          codeRuns: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      })
    : await getPrisma().codeSubmission.create({
        data: {
          userProfileId,
          problemId,
          attemptId: context.attemptId,
          interviewRoundId: context.interviewRoundId,
          battleRoundId: context.battleRoundId,
          language: CodeLanguage.Python,
          code,
          status,
        },
        include: {
          codeRuns: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
          },
        },
      });

  return { ok: true as const, submission };
}

export async function saveCodeSubmissionAction(
  input: SaveCodeSubmissionActionInput,
): Promise<SaveCodeSubmissionActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before saving code." };
  }

  if (!isRecord(input)) {
    return { status: "invalid", message: "Code submission payload is invalid." };
  }

  if (input.language !== "Python") {
    return { status: "invalid", message: "PatternForge v0.7 supports Python only." };
  }

  const codeError = validateCodePayload(input.code);

  if (codeError) {
    return { status: "invalid", message: codeError };
  }

  const context = await validateWorkspaceContext({
    userProfileId: userProfile.id,
    input,
  });

  if (!context.ok) {
    return { status: "invalid", message: context.message };
  }

  const savedSubmission = await saveOrUpdateSubmission({
    codeSubmissionId: input.codeSubmissionId,
    userProfileId: userProfile.id,
    problemId: input.problemId,
    context: context.context,
    code: input.code,
    status: CodeSubmissionStatus.Draft,
  });

  if (!savedSubmission.ok) {
    return { status: "invalid", message: savedSubmission.message };
  }

  return {
    status: "saved",
    historyItem: toHistoryItem(savedSubmission.submission),
    message: "Code saved as a PatternForge draft.",
  };
}

async function createPendingRun({
  userProfileId,
  codeSubmissionId,
  runType,
}: {
  userProfileId: string;
  codeSubmissionId: string;
  runType: "CustomTests" | "FreeRun";
}) {
  return getPrisma().codeRun.create({
    data: {
      userProfileId,
      codeSubmissionId,
      runType:
        runType === "FreeRun"
          ? CodeRunType.FreeRun
          : CodeRunType.CustomTests,
      status: CodeRunStatus.Running,
      stdout: "",
      stderr: "",
    },
  });
}

async function updateRunWithResults({
  codeRunId,
  result,
}: {
  codeRunId: string;
  result: CodeRunResult;
}) {
  const updatedRun = await getPrisma().codeRun.update({
    where: {
      id: codeRunId,
    },
    data: {
      status: result.status as CodeRunStatus,
      stdout: result.stdout,
      stderr: result.stderr,
      errorMessage: result.errorMessage,
      runtimeMs: result.runtimeMs,
    },
  });

  if (result.testResults.length > 0) {
    await getPrisma().testResult.createMany({
      data: result.testResults.map((testResult) => ({
        codeRunId: updatedRun.id,
        testCaseId: testResult.testCaseId,
        name: testResult.name,
        inputJson: toJsonValue(testResult.inputJson),
        expectedOutputJson: toJsonValue(testResult.expectedOutputJson),
        actualOutputJson: toNullableJsonValue(testResult.actualOutputJson),
        passed: testResult.passed,
        stdout: testResult.stdout,
        stderr: testResult.stderr,
        errorMessage: testResult.errorMessage,
        runtimeMs: testResult.runtimeMs,
      })),
    });
  }

  return updatedRun;
}

export async function saveWorkspaceTestCasesAction(
  input: SaveWorkspaceTestCasesInput,
): Promise<SaveWorkspaceTestCasesActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before saving custom tests." };
  }

  if (!isRecord(input)) {
    return { status: "invalid", message: "Custom test payload is invalid." };
  }

  const payloadError = validateWorkspaceTestPayload(input.tests);

  if (payloadError) {
    return { status: "invalid", message: payloadError };
  }

  const context = await validateWorkspaceContext({
    userProfileId: userProfile.id,
    input,
  });

  if (!context.ok) {
    return { status: "invalid", message: context.message };
  }

  const runnerConfig = await getRunnerConfig(input.problemId, "Python");

  if (!runnerConfig) {
    return {
      status: "invalid",
      message: STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE,
    };
  }

  for (const test of input.tests) {
    const inputValidation = validateTestInputAgainstSchema(
      runnerConfig,
      test.inputJson,
    );

    if (!inputValidation.ok) {
      return { status: "invalid", message: inputValidation.errorMessage };
    }

    const outputValidation = validateTestOutputAgainstSchema(
      runnerConfig,
      test.expectedOutputJson,
    );

    if (!outputValidation.ok) {
      return { status: "invalid", message: outputValidation.errorMessage };
    }
  }

  const savedTests = await getPrisma().$transaction(async (tx) => {
    const rows = [];

    for (const test of input.tests) {
      const existingId = readNonEmpty(test.id);

      if (existingId) {
        const updated = await tx.testCase.updateManyAndReturn({
          where: {
            id: existingId,
            userProfileId: userProfile.id,
            problemId: input.problemId,
            source: TestCaseSource.User,
          },
          data: {
            name: test.name.trim(),
            inputJson: toJsonValue(test.inputJson),
            expectedOutputJson: toJsonValue(test.expectedOutputJson),
            isPublic: false,
          },
        });

        if (updated[0]) {
          rows.push(updated[0]);
          continue;
        }
      }

      rows.push(
        await tx.testCase.create({
          data: {
            userProfileId: userProfile.id,
            problemId: input.problemId,
            source: TestCaseSource.User,
            name: test.name.trim(),
            inputJson: toJsonValue(test.inputJson),
            expectedOutputJson: toJsonValue(test.expectedOutputJson),
            isPublic: false,
          },
        }),
      );
    }

    return rows;
  });

  return {
    status: "saved",
    tests: savedTests.map(toWorkspaceTestCaseItem),
    message: "Custom tests saved. These are user tests, not official LeetCode tests.",
  };
}

export async function runWorkspaceCodeAction(
  input: WorkspaceRunActionInput,
): Promise<WorkspaceRunActionResult> {
  if (!getFeatureFlag("codeRunner")) {
    return {
      status: "invalid",
      message: "Code runner is temporarily unavailable.",
    };
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before running code." };
  }

  const rateLimit = await checkRateLimit({
    kind: "codeRuns",
    userProfileId: userProfile.id,
  });

  if (!rateLimit.ok) {
    return { status: "invalid", message: rateLimit.message };
  }

  if (!isRecord(input)) {
    return { status: "invalid", message: "Code run payload is invalid." };
  }

  if (input.language !== "Python") {
    return { status: "invalid", message: "PatternForge v0.7 supports Python only." };
  }

  const codeError = validateCodePayload(input.code);

  if (codeError) {
    return { status: "invalid", message: codeError };
  }

  const unavailableMessage = getCodeExecutionUnavailableMessage();

  if (unavailableMessage) {
    return { status: "invalid", message: unavailableMessage };
  }

  if (!isWorkspaceRunType(input.runType)) {
    return { status: "invalid", message: "Unsupported run type." };
  }

  const context = await validateWorkspaceContext({
    userProfileId: userProfile.id,
    input,
  });

  if (!context.ok) {
    return { status: "invalid", message: context.message };
  }

  const runnableTests =
    input.runType === "FreeRun"
      ? { ok: true as const, tests: [] }
      : await validateRunnableTests({
          userProfileId: userProfile.id,
          problemId: input.problemId,
          tests: input.tests,
        });

  if (!runnableTests.ok) {
    return { status: "invalid", message: runnableTests.message };
  }

  const savedSubmission = await saveOrUpdateSubmission({
    codeSubmissionId: input.codeSubmissionId,
    userProfileId: userProfile.id,
    problemId: input.problemId,
    context: context.context,
    code: input.code,
    status: CodeSubmissionStatus.Submitted,
  });

  if (!savedSubmission.ok) {
    return { status: "invalid", message: savedSubmission.message };
  }

  const pendingRun = await createPendingRun({
    userProfileId: userProfile.id,
    codeSubmissionId: savedSubmission.submission.id,
    runType: input.runType,
  });
  await trackEvent({
    eventName: AnalyticsEvents.CodeRunStarted,
    userProfileId: userProfile.id,
    properties: {
      codeRunId: pendingRun.id,
      codeSubmissionId: savedSubmission.submission.id,
      problemId: input.problemId,
      runType: input.runType,
      testCount: runnableTests.tests.length,
      attemptId: context.context.attemptId,
      interviewRoundId: context.context.interviewRoundId,
      battleRoundId: context.context.battleRoundId,
    },
  });

  let result: CodeRunResult;

  try {
    result = await runCode({
      problemId: input.problemId,
      language: input.language,
      code: input.code,
      tests: runnableTests.tests,
      runType: input.runType,
    });
  } catch {
    result = {
      status: "RuntimeError",
      stdout: "",
      stderr: "",
      errorMessage: "Code execution failed safely before results were saved.",
      testResults: [],
    };
  }

  const run = await updateRunWithResults({
    codeRunId: pendingRun.id,
    result,
  });
  await trackEvent({
    eventName: AnalyticsEvents.CodeRunCompleted,
    userProfileId: userProfile.id,
    properties: {
      codeRunId: run.id,
      codeSubmissionId: savedSubmission.submission.id,
      problemId: input.problemId,
      runType: input.runType,
      status: run.status,
      runtimeMs: run.runtimeMs ?? undefined,
      testCount: result.testResults.length,
      passedTestCount: result.testResults.filter((testResult) => testResult.passed)
        .length,
      attemptId: context.context.attemptId,
      interviewRoundId: context.context.interviewRoundId,
      battleRoundId: context.context.battleRoundId,
    },
  });

  const submissionForHistory = await getPrisma().codeSubmission.findUniqueOrThrow({
    where: {
      id: savedSubmission.submission.id,
    },
    include: {
      codeRuns: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
  });

  return {
    status: "completed",
    result,
    codeRunId: run.id,
    codeSubmissionId: savedSubmission.submission.id,
    historyItem: toHistoryItem(submissionForHistory),
  };
}

export async function createDebugInsightAction(
  codeRunId: string,
): Promise<CreateDebugInsightActionResult> {
  if (!getFeatureFlag("aiCoach")) {
    return {
      status: "invalid",
      message: "Debug Coach is temporarily unavailable.",
    };
  }

  const userProfile = await ensureCurrentUserProfile();
  const scopedCodeRunId = readNonEmpty(codeRunId);

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before using Debug Coach." };
  }

  const rateLimit = await checkRateLimit({
    kind: "debugCoach",
    userProfileId: userProfile.id,
  });

  if (!rateLimit.ok) {
    return { status: "invalid", message: rateLimit.message };
  }

  if (!scopedCodeRunId) {
    return { status: "invalid", message: "Code run was not found." };
  }

  const run = await getPrisma().codeRun.findFirst({
    where: {
      id: scopedCodeRunId,
      userProfileId: userProfile.id,
    },
    include: {
      codeSubmission: {
        include: {
          problem: true,
          attempt: {
            include: {
              correctPattern: true,
            },
          },
          interviewRound: {
            include: {
              correctPattern: true,
            },
          },
          battleRound: {
            include: {
              attempt: {
                include: {
                  correctPattern: true,
                },
              },
            },
          },
        },
      },
      testResults: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!run) {
    return { status: "invalid", message: "Code run was not found." };
  }

  if (run.status === CodeRunStatus.Succeeded) {
    return {
      status: "invalid",
      message: "Debug Coach is available after failed runs.",
    };
  }

  const knownPatternName =
    run.codeSubmission.attempt?.correctPattern.name ??
    (run.codeSubmission.interviewRound?.completedAt
      ? run.codeSubmission.interviewRound.correctPattern.name
      : null) ??
    run.codeSubmission.battleRound?.attempt?.correctPattern.name ??
    null;
  const previousAttemptReflection =
    run.codeSubmission.attempt?.reflection ??
    run.codeSubmission.battleRound?.attempt?.reflection ??
    null;
  let debugOutput: DebugCoachOutput;

  try {
    debugOutput = await requestDebugCoach({
      problemTitle: run.codeSubmission.problem.title,
      difficulty: run.codeSubmission.problem.difficulty,
      knownPatternName,
      recognitionClues: run.codeSubmission.problem.recognitionClues,
      commonMistakes: run.codeSubmission.problem.commonMistakes,
      userCode: run.codeSubmission.code,
      tests: run.testResults.map((testResult) => ({
        name: testResult.name,
        inputJson: testResult.inputJson,
        expectedOutputJson: testResult.expectedOutputJson,
        actualOutputJson: testResult.actualOutputJson,
        passed: testResult.passed,
        stdout: testResult.stdout ?? undefined,
        stderr: testResult.stderr ?? undefined,
        errorMessage: testResult.errorMessage ?? undefined,
        runtimeMs: testResult.runtimeMs ?? undefined,
      })),
      stdout: run.stdout,
      stderr: run.stderr,
      runtimeError: run.errorMessage,
      previousAttemptReflection,
    });
  } catch {
    return {
      status: "invalid",
      message: "Debug Coach could not review this run. Try again later.",
    };
  }

  const insight = await getPrisma().debugInsight.create({
    data: {
      userProfileId: userProfile.id,
      codeRunId: run.id,
      attemptId: run.codeSubmission.attemptId,
      interviewRoundId: run.codeSubmission.interviewRoundId,
      summary: debugOutput.summary,
      likelyCause: debugOutput.likelyCause,
      suggestedFix: debugOutput.suggestedFix,
      followUpQuestion: debugOutput.followUpQuestion,
    },
  });

  return {
    status: "created",
    insight: toDebugInsightView(insight, debugOutput),
  };
}

async function getOwnedDebugInsight(
  insightId: string,
  userProfileId: string,
) {
  const scopedInsightId = readNonEmpty(insightId);

  if (!scopedInsightId) {
    return null;
  }

  return getPrisma().debugInsight.findFirst({
    where: {
      id: scopedInsightId,
      userProfileId,
    },
    include: {
      attempt: true,
      interviewRound: true,
      codeRun: {
        include: {
          codeSubmission: {
            include: {
              battleRound: {
                include: {
                  attempt: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

export async function createFlashcardFromDebugInsightAction(
  insightId: string,
): Promise<CreateDebugStudyCardActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before creating a flashcard." };
  }

  const insight = await getOwnedDebugInsight(insightId, userProfile.id);

  if (!insight) {
    return { status: "invalid", message: "Debug insight was not found." };
  }

  const sourceAttempt =
    insight.attempt ?? insight.codeRun.codeSubmission.battleRound?.attempt ?? null;
  const patternId =
    sourceAttempt?.correctPatternId ?? insight.interviewRound?.correctPatternId;

  if (!patternId) {
    return {
      status: "invalid",
      message: "This insight does not have enough pattern context for a flashcard.",
    };
  }

  await getPrisma().flashcard.create({
    data: {
      userProfileId: userProfile.id,
      sourceAttemptId: sourceAttempt?.id,
      patternId,
      front: `Debug this failure: ${insight.summary}`,
      back: [insight.likelyCause, insight.suggestedFix].join("\n\n"),
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/flashcards");
  revalidatePath("/review");

  return { status: "created", message: "Flashcard created from Debug Coach insight." };
}

export async function createMistakeFromDebugInsightAction(
  insightId: string,
): Promise<CreateDebugStudyCardActionResult> {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return { status: "unauthenticated", message: "Sign in before creating a mistake card." };
  }

  const insight = await getOwnedDebugInsight(insightId, userProfile.id);

  if (!insight) {
    return { status: "invalid", message: "Debug insight was not found." };
  }

  const sourceAttempt =
    insight.attempt ?? insight.codeRun.codeSubmission.battleRound?.attempt ?? null;

  if (!sourceAttempt) {
    return {
      status: "invalid",
      message: "Mistake cards require a saved practice or battle attempt.",
    };
  }

  await getPrisma().mistake.create({
    data: {
      userProfileId: userProfile.id,
      attemptId: sourceAttempt.id,
      problemId: sourceAttempt.problemId,
      patternId: sourceAttempt.correctPatternId,
      mistakeType: "Debug Coach finding",
      description: insight.likelyCause,
      correction: insight.suggestedFix,
      reviewDueAt: new Date(),
    },
  });

  revalidatePath("/mistakes");
  revalidatePath("/review");

  return { status: "created", message: "Mistake card created from Debug Coach insight." };
}
