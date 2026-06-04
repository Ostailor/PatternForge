import { notFound } from "next/navigation";

import type {
  DebugInsightView,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "@/components/code-workspace/types";
import { TestCaseSource } from "@/generated/prisma/client";
import { patterns } from "@/data/patterns";
import { getProblemById, problems } from "@/data/problems";
import {
  getCodeExecutionUnavailableMessage,
  isCodeExecutionAvailable,
} from "@/lib/code-runner/executor";
import { getRunnerConfig } from "@/lib/code-runner/runnerConfig";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import ProblemPracticeClient from "./practice-client";

type ProblemDetailPageProps = {
  params: Promise<{ problemId: string }>;
};

export function generateStaticParams() {
  return problems.map((problem) => ({
    problemId: problem.id,
  }));
}

async function getRunnerConfigSafely(problemId: string) {
  try {
    return await getRunnerConfig(problemId, "Python");
  } catch {
    return null;
  }
}

async function getPracticeSubmissionHistory({
  userProfileId,
  problemId,
}: {
  userProfileId: string;
  problemId: string;
}): Promise<WorkspaceSubmissionHistoryItem[]> {
  try {
    const submissions = await getPrisma().codeSubmission.findMany({
      where: {
        userProfileId,
        problemId,
        attemptId: null,
        interviewRoundId: null,
        battleRoundId: null,
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
        updatedAt: "desc",
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

async function getPracticeTestCases({
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

async function getLatestPracticeDebugInsight({
  userProfileId,
  problemId,
}: {
  userProfileId: string;
  problemId: string;
}): Promise<DebugInsightView | null> {
  try {
    const insight = await getPrisma().debugInsight.findFirst({
      where: {
        userProfileId,
        codeRun: {
          codeSubmission: {
            problemId,
            attemptId: null,
            interviewRoundId: null,
            battleRoundId: null,
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

export default async function ProblemDetailPage({
  params,
}: ProblemDetailPageProps) {
  const [{ problemId }, userProfile] = await Promise.all([
    params,
    ensureCurrentUserProfile(),
  ]);
  const problem = getProblemById(problemId);

  if (!problem) {
    notFound();
  }

  const [runnerConfig, history, testCases, latestDebugInsight] =
    await Promise.all([
      getRunnerConfigSafely(problem.id),
      userProfile
        ? getPracticeSubmissionHistory({
            userProfileId: userProfile.id,
            problemId: problem.id,
          })
        : Promise.resolve([]),
      getPracticeTestCases({
        userProfileId: userProfile?.id ?? null,
        problemId: problem.id,
      }),
      userProfile
        ? getLatestPracticeDebugInsight({
            userProfileId: userProfile.id,
            problemId: problem.id,
          })
        : Promise.resolve(null),
    ]);
  const codeRunnerEnabled =
    getFeatureFlag("codeRunner") && isCodeExecutionAvailable();
  const codeRunnerUnavailableMessage =
    getFeatureFlag("codeRunner")
      ? getCodeExecutionUnavailableMessage()
      : "Code execution is temporarily unavailable.";
  const aiCoachEnabled = getFeatureFlag("aiCoach");

  return (
    <ProblemPracticeClient
      problem={problem}
      patterns={patterns}
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
