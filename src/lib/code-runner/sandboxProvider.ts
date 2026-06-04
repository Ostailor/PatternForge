import {
  MAX_CODE_LENGTH,
  MAX_OUTPUT_CAPTURE,
  MAX_TEST_EXPECTED_OUTPUT_SIZE,
  MAX_TEST_INPUT_SIZE,
  MAX_TESTS_PER_RUN,
  RUN_TIMEOUT_MS,
} from "@/lib/code-runner/limits";
import { createCodeRunResult } from "@/lib/code-runner/results";
import type {
  CodeRunResult,
  CodeRunStatus,
  TestExecutionResult,
  ValidatedCodeRunRequest,
} from "@/lib/code-runner/types";

export type CodeRunnerSandboxProvider = {
  run(request: ValidatedCodeRunRequest): Promise<CodeRunResult>;
};

type SandboxResponse = Partial<CodeRunResult>;

const validStatuses = new Set<CodeRunStatus>([
  "Queued",
  "Running",
  "Succeeded",
  "Failed",
  "TimedOut",
  "RuntimeError",
  "ValidationError",
]);

function getSandboxUrl(): string | null {
  const url = process.env.CODE_RUNNER_SANDBOX_URL?.trim();

  return url || null;
}

function getSandboxToken(): string | null {
  const token = process.env.CODE_RUNNER_SANDBOX_TOKEN?.trim();

  return token || null;
}

function isSandboxResponse(value: unknown): value is SandboxResponse {
  return typeof value === "object" && value !== null;
}

function toTestResults(value: unknown): TestExecutionResult[] {
  return Array.isArray(value) ? (value as TestExecutionResult[]) : [];
}

function normalizeSandboxResponse(value: unknown): CodeRunResult {
  if (!isSandboxResponse(value)) {
    return createCodeRunResult({
      status: "RuntimeError",
      errorMessage: "Sandbox returned an invalid response.",
    });
  }

  return createCodeRunResult({
    status:
      typeof value.status === "string" && validStatuses.has(value.status)
        ? value.status
        : "RuntimeError",
    stdout: typeof value.stdout === "string" ? value.stdout : "",
    stderr: typeof value.stderr === "string" ? value.stderr : "",
    errorMessage:
      typeof value.errorMessage === "string"
        ? value.errorMessage
        : undefined,
    runtimeMs:
      typeof value.runtimeMs === "number" && Number.isFinite(value.runtimeMs)
        ? value.runtimeMs
        : undefined,
    testResults: toTestResults(value.testResults),
  });
}

class HttpCodeRunnerSandboxProvider implements CodeRunnerSandboxProvider {
  constructor(private readonly url: string) {}

  async run(request: ValidatedCodeRunRequest): Promise<CodeRunResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS + 1_000);
    const sandboxToken = getSandboxToken();

    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(sandboxToken
            ? {
                authorization: `Bearer ${sandboxToken}`,
              }
            : {}),
        },
        body: JSON.stringify({
          request,
          limits: {
            timeoutMs: RUN_TIMEOUT_MS,
            maxOutputCapture: MAX_OUTPUT_CAPTURE,
            maxCodeLength: MAX_CODE_LENGTH,
            maxTestsPerRun: MAX_TESTS_PER_RUN,
            maxTestInputSize: MAX_TEST_INPUT_SIZE,
            maxTestExpectedOutputSize: MAX_TEST_EXPECTED_OUTPUT_SIZE,
          },
          isolation: {
            network: false,
            secrets: false,
            persistentFilesystem: false,
            arbitraryShell: false,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return createCodeRunResult({
          status: "RuntimeError",
          errorMessage: "Sandbox execution failed safely.",
        });
      }

      return normalizeSandboxResponse(await response.json());
    } catch {
      return createCodeRunResult({
        status: "RuntimeError",
        errorMessage: "Sandbox execution failed safely.",
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function getCodeRunnerSandboxProvider(): CodeRunnerSandboxProvider | null {
  const sandboxUrl = getSandboxUrl();

  return sandboxUrl ? new HttpCodeRunnerSandboxProvider(sandboxUrl) : null;
}
