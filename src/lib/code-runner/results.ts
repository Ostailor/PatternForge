import { MAX_OUTPUT_CAPTURE } from "@/lib/code-runner/limits";
import type {
  CodeRunResult,
  CodeRunStatus,
  TestExecutionResult,
} from "@/lib/code-runner/types";

const TRUNCATION_NOTICE = "\n...[truncated by PatternForge output limit]";

export function truncateOutput(value: string, limit = MAX_OUTPUT_CAPTURE): string {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, Math.max(0, limit - TRUNCATION_NOTICE.length))}${TRUNCATION_NOTICE}`;
}

export function createCodeRunResult({
  status,
  stdout = "",
  stderr = "",
  errorMessage,
  runtimeMs,
  testResults = [],
}: {
  status: CodeRunStatus;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  runtimeMs?: number;
  testResults?: TestExecutionResult[];
}): CodeRunResult {
  return {
    status,
    stdout: truncateOutput(stdout),
    stderr: truncateOutput(stderr),
    ...(errorMessage ? { errorMessage: truncateOutput(errorMessage) } : {}),
    ...(typeof runtimeMs === "number" ? { runtimeMs } : {}),
    testResults: testResults.map((result) => ({
      ...result,
      ...(typeof result.stdout === "string"
        ? { stdout: truncateOutput(result.stdout) }
        : {}),
      ...(typeof result.stderr === "string"
        ? { stderr: truncateOutput(result.stderr) }
        : {}),
      ...(typeof result.errorMessage === "string"
        ? { errorMessage: truncateOutput(result.errorMessage) }
        : {}),
    })),
  };
}

export function statusFromTestResults(
  testResults: TestExecutionResult[],
): CodeRunStatus {
  if (testResults.some((result) => result.errorMessage)) {
    return "RuntimeError";
  }

  return testResults.every((result) => result.passed) ? "Succeeded" : "Failed";
}

