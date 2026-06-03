import "server-only";

import type { CodeRunStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

import type {
  CodeExecutionMetrics,
  CodeExecutionPatternSignal,
} from "./types";

type CodeRunMetricRow = {
  status: CodeRunStatus;
  codeSubmission: {
    problemId: string;
    problem: {
      problemPatterns: Array<{
        isPrimary: boolean;
        pattern: {
          id: string;
          name: string;
        };
      }>;
    };
  };
  testResults: Array<{
    passed: boolean;
  }>;
};

const emptyCodeExecutionMetrics: CodeExecutionMetrics = {
  totalCodeSubmissions: 0,
  totalCodeRuns: 0,
  customTestPassRate: 0,
  runtimeErrorRate: 0,
  timeoutRate: 0,
  averageTestsPerRun: 0,
  problemsWithSuccessfulSelfTests: 0,
  patternsWithRuntimeErrors: [],
  patternsWithRepeatedFailedTests: [],
};

function percentage(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

function getPrimaryPattern(run: CodeRunMetricRow) {
  return (
    run.codeSubmission.problem.problemPatterns.find((problemPattern) => problemPattern.isPrimary)
      ?.pattern ?? run.codeSubmission.problem.problemPatterns[0]?.pattern ?? null
  );
}

function addPatternCount(
  counts: Map<string, CodeExecutionPatternSignal>,
  run: CodeRunMetricRow,
): void {
  const pattern = getPrimaryPattern(run);

  if (!pattern) {
    return;
  }

  const current = counts.get(pattern.id) ?? {
    patternId: pattern.id,
    patternName: pattern.name,
    count: 0,
  };

  current.count += 1;
  counts.set(pattern.id, current);
}

function topPatternSignals(
  counts: Map<string, CodeExecutionPatternSignal>,
): CodeExecutionPatternSignal[] {
  return Array.from(counts.values())
    .sort((left, right) => right.count - left.count || left.patternName.localeCompare(right.patternName))
    .slice(0, 5);
}

export async function getCodeExecutionMetrics(
  userProfileId: string,
): Promise<CodeExecutionMetrics> {
  const scopedUserProfileId = userProfileId.trim();

  if (!scopedUserProfileId) {
    return emptyCodeExecutionMetrics;
  }

  const prisma = getPrisma();
  const [totalCodeSubmissions, runs] = await Promise.all([
    prisma.codeSubmission.count({
      where: {
        userProfileId: scopedUserProfileId,
      },
    }),
    prisma.codeRun.findMany({
      where: {
        userProfileId: scopedUserProfileId,
      },
      select: {
        status: true,
        codeSubmission: {
          select: {
            problemId: true,
            problem: {
              select: {
                problemPatterns: {
                  select: {
                    isPrimary: true,
                    pattern: {
                      select: {
                        id: true,
                        name: true,
                      },
                    },
                  },
                  orderBy: {
                    isPrimary: "desc",
                  },
                },
              },
            },
          },
        },
        testResults: {
          select: {
            passed: true,
          },
        },
      },
    }),
  ]);

  if (runs.length === 0) {
    return {
      ...emptyCodeExecutionMetrics,
      totalCodeSubmissions,
    };
  }

  const totalTests = runs.reduce(
    (total, run) => total + run.testResults.length,
    0,
  );
  const passedTests = runs.reduce(
    (total, run) =>
      total + run.testResults.filter((testResult) => testResult.passed).length,
    0,
  );
  const runtimeErrorRuns = runs.filter((run) => run.status === "RuntimeError");
  const timeoutRuns = runs.filter((run) => run.status === "TimedOut");
  const successfulSelfTestProblemIds = new Set(
    runs
      .filter(
        (run) =>
          run.testResults.length > 0 &&
          run.testResults.every((testResult) => testResult.passed),
      )
      .map((run) => run.codeSubmission.problemId),
  );
  const runtimeErrorPatternCounts = new Map<string, CodeExecutionPatternSignal>();
  const failedTestPatternCounts = new Map<string, CodeExecutionPatternSignal>();

  for (const run of runtimeErrorRuns) {
    addPatternCount(runtimeErrorPatternCounts, run);
  }

  for (const run of runs) {
    if (
      run.testResults.length > 0 &&
      run.testResults.some((testResult) => !testResult.passed)
    ) {
      addPatternCount(failedTestPatternCounts, run);
    }
  }

  return {
    totalCodeSubmissions,
    totalCodeRuns: runs.length,
    customTestPassRate: percentage(passedTests, totalTests),
    runtimeErrorRate: percentage(runtimeErrorRuns.length, runs.length),
    timeoutRate: percentage(timeoutRuns.length, runs.length),
    averageTestsPerRun:
      runs.length === 0 ? 0 : Math.round((totalTests / runs.length) * 10) / 10,
    problemsWithSuccessfulSelfTests: successfulSelfTestProblemIds.size,
    patternsWithRuntimeErrors: topPatternSignals(runtimeErrorPatternCounts),
    patternsWithRepeatedFailedTests: topPatternSignals(failedTestPatternCounts).filter(
      (pattern) => pattern.count >= 2,
    ),
  };
}
