import { notFound } from "next/navigation";

import { CodeWorkspace } from "@/components/code-workspace";
import type {
  DebugInsightView,
  WorkspaceContext,
  WorkspaceMode,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "@/components/code-workspace/types";
import { TestCaseSource } from "@/generated/prisma/client";
import { getProblemById, problems } from "@/data/problems";
import {
  getCodeExecutionUnavailableMessage,
  isCodeExecutionAvailable,
} from "@/lib/code-runner/executor";
import { getRunnerConfig } from "@/lib/code-runner/runnerConfig";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type ProblemWorkspacePageProps = {
  params: Promise<{ problemId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return problems.map((problem) => ({
    problemId: problem.id,
  }));
}

function getSearchValue(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | undefined {
  const value = searchParams?.[key];

  return Array.isArray(value) ? value[0] : value;
}

function getWorkspaceMode(value: string | undefined): WorkspaceMode {
  if (value === "Interview" || value === "interview") {
    return "Interview";
  }

  if (value === "Battle" || value === "battle") {
    return "Battle";
  }

  return "Practice";
}

function getReturnLink({
  mode,
  problemId,
  searchParams,
}: {
  mode: WorkspaceMode;
  problemId: string;
  searchParams: Record<string, string | string[] | undefined> | undefined;
}) {
  const explicitReturnHref = getSearchValue(searchParams, "returnHref");

  if (explicitReturnHref?.startsWith("/")) {
    return {
      returnHref: explicitReturnHref,
      returnLabel: "Back to flow",
    };
  }

  const interviewId = getSearchValue(searchParams, "interviewId");
  const battleId = getSearchValue(searchParams, "battleId");

  if (mode === "Interview" && interviewId) {
    return {
      returnHref: `/interviews/${interviewId}`,
      returnLabel: "Back to Interview",
    };
  }

  if (mode === "Battle" && battleId) {
    return {
      returnHref: `/battles/${battleId}`,
      returnLabel: "Back to Battle",
    };
  }

  return {
    returnHref: `/problems/${problemId}`,
    returnLabel: "Back to Practice",
  };
}

async function getSubmissionHistory({
  userProfileId,
  problemId,
  attemptId,
  interviewRoundId,
  battleRoundId,
}: {
  userProfileId: string;
  problemId: string;
  attemptId?: string;
  interviewRoundId?: string;
  battleRoundId?: string;
}): Promise<WorkspaceSubmissionHistoryItem[]> {
  try {
    const submissions = await getPrisma().codeSubmission.findMany({
      where: {
        userProfileId,
        problemId,
        ...(attemptId ? { attemptId } : {}),
        ...(interviewRoundId ? { interviewRoundId } : {}),
        ...(battleRoundId ? { battleRoundId } : {}),
      },
      include: {
        codeRuns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    });

    return submissions.map((submission) => ({
      id: submission.id,
      language: "Python",
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
      runCount: submission.codeRuns.length,
      latestRunStatus: submission.codeRuns[0]?.status ?? null,
    }));
  } catch {
    return [];
  }
}

async function getWorkspaceTestCases({
  userProfileId,
  problemId,
}: {
  userProfileId: string | null;
  problemId: string;
}): Promise<WorkspaceTestCaseItem[]> {
  try {
    const testCases = await getPrisma().testCase.findMany({
      where: {
        problemId,
        OR: [
          {
            source: TestCaseSource.PatternForge,
            isPublic: true,
          },
          ...(userProfileId
            ? [
                {
                  source: TestCaseSource.User,
                  userProfileId,
                },
              ]
            : []),
        ],
      },
      orderBy: [
        {
          source: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 10,
    });

    return testCases.map((testCase) => ({
      id: testCase.id,
      source: testCase.source,
      name: testCase.name,
      inputJson: testCase.inputJson,
      expectedOutputJson: testCase.expectedOutputJson,
      isPublic: testCase.isPublic,
      createdAt: testCase.createdAt.toISOString(),
      updatedAt: testCase.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

async function getLatestDebugInsight({
  userProfileId,
  problemId,
  attemptId,
  interviewRoundId,
  battleRoundId,
}: {
  userProfileId: string;
  problemId: string;
  attemptId?: string;
  interviewRoundId?: string;
  battleRoundId?: string;
}): Promise<DebugInsightView | null> {
  try {
    const insight = await getPrisma().debugInsight.findFirst({
      where: {
        userProfileId,
        ...(attemptId ? { attemptId } : {}),
        ...(interviewRoundId ? { interviewRoundId } : {}),
        codeRun: {
          codeSubmission: {
            problemId,
            ...(battleRoundId ? { battleRoundId } : {}),
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return insight
      ? {
          id: insight.id,
          summary: insight.summary,
          likelyCause: insight.likelyCause,
          suggestedFix: insight.suggestedFix,
          followUpQuestion: insight.followUpQuestion,
          createdAt: insight.createdAt.toISOString(),
        }
      : null;
  } catch {
    return null;
  }
}

async function getRunnerConfigSafely(problemId: string) {
  try {
    return await getRunnerConfig(problemId, "Python");
  } catch {
    return null;
  }
}

export default async function ProblemWorkspacePage({
  params,
  searchParams,
}: ProblemWorkspacePageProps) {
  const [{ problemId }, resolvedSearchParams, userProfile] = await Promise.all([
    params,
    searchParams,
    ensureCurrentUserProfile(),
  ]);
  const problem = getProblemById(problemId);

  if (!problem) {
    notFound();
  }

  const mode = getWorkspaceMode(getSearchValue(resolvedSearchParams, "mode"));
  const attemptId = getSearchValue(resolvedSearchParams, "attemptId");
  const interviewRoundId = getSearchValue(resolvedSearchParams, "interviewRoundId");
  const battleRoundId = getSearchValue(resolvedSearchParams, "battleRoundId");
  const { returnHref, returnLabel } = getReturnLink({
    mode,
    problemId: problem.id,
    searchParams: resolvedSearchParams,
  });
  const [runnerConfig, history, testCases, latestDebugInsight] = await Promise.all([
    getRunnerConfigSafely(problem.id),
    userProfile
      ? getSubmissionHistory({
          userProfileId: userProfile.id,
          problemId: problem.id,
          attemptId,
          interviewRoundId,
          battleRoundId,
        })
      : Promise.resolve([]),
    getWorkspaceTestCases({
      userProfileId: userProfile?.id ?? null,
      problemId: problem.id,
    }),
    userProfile
      ? getLatestDebugInsight({
          userProfileId: userProfile.id,
          problemId: problem.id,
          attemptId,
          interviewRoundId,
          battleRoundId,
        })
      : Promise.resolve(null),
  ]);
  const context: WorkspaceContext = {
    mode,
    attemptId,
    interviewRoundId,
    battleRoundId,
    returnHref,
    returnLabel,
  };
  const codeRunnerEnabled =
    getFeatureFlag("codeRunner") && isCodeExecutionAvailable();
  const codeRunnerUnavailableMessage =
    getFeatureFlag("codeRunner")
      ? getCodeExecutionUnavailableMessage()
      : "Code execution is temporarily unavailable.";
  const aiCoachEnabled = getFeatureFlag("aiCoach");

  return (
    <CodeWorkspace
      problem={problem}
      context={context}
      runnerConfigured={Boolean(runnerConfig)}
      codeRunnerEnabled={codeRunnerEnabled}
      codeRunnerUnavailableMessage={codeRunnerUnavailableMessage ?? undefined}
      aiCoachEnabled={aiCoachEnabled}
      initialHistory={history}
      initialTestCases={testCases}
      initialDebugInsight={latestDebugInsight}
      isAuthenticated={Boolean(userProfile)}
    />
  );
}
