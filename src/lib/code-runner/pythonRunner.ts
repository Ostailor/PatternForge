import {
  spawn,
  type ChildProcessWithoutNullStreams,
} from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  MAX_OUTPUT_CAPTURE,
  PYTHON_EXECUTABLE,
  RUN_TIMEOUT_MS,
} from "@/lib/code-runner/limits";
import {
  CODE_RUNNER_LOCAL_DEV_ONLY_MESSAGE,
  isLocalDevCodeRunnerAllowed,
} from "@/lib/code-runner/mode";
import { createCodeRunResult, truncateOutput } from "@/lib/code-runner/results";
import {
  buildPythonFreeRunHarnessSource,
  buildPythonHarnessSource,
} from "@/lib/code-runner/testHarness";
import type {
  CodeRunResult,
  TestExecutionResult,
  ValidatedCodeRunRequest,
} from "@/lib/code-runner/types";

type HarnessPayload = {
  status?: CodeRunResult["status"];
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  testResults?: TestExecutionResult[];
};

function collectLimitedOutput(current: string, chunk: Buffer): string {
  const next = current + chunk.toString("utf8");
  const protocolLimit = MAX_OUTPUT_CAPTURE * 20;

  return next.length > protocolLimit ? next.slice(0, protocolLimit) : next;
}

function safeParseHarnessPayload(stdout: string): HarnessPayload | null {
  try {
    return JSON.parse(stdout) as HarnessPayload;
  } catch {
    return null;
  }
}

function sanitizeRunnerErrorMessage(error: Error): string {
  return error.message
    .replaceAll(process.cwd(), "<app-dir>")
    .replaceAll(tmpdir(), "<tmp-dir>");
}

export async function runPythonCode(
  request: ValidatedCodeRunRequest,
): Promise<CodeRunResult> {
  if (!isLocalDevCodeRunnerAllowed()) {
    return createCodeRunResult({
      status: "ValidationError",
      errorMessage: CODE_RUNNER_LOCAL_DEV_ONLY_MESSAGE,
    });
  }

  const started = performance.now();
  const runDir = path.join(
    tmpdir(),
    `patternforge-code-${Date.now()}-${randomUUID()}`,
  );

  await mkdir(runDir, { recursive: true });

  try {
    const solutionPath = path.join(runDir, "solution.py");
    const harnessPath = path.join(runDir, "harness.py");

    await Promise.all([
      writeFile(solutionPath, request.code, { encoding: "utf8", mode: 0o600 }),
      writeFile(
        harnessPath,
        request.runType === "FreeRun"
          ? buildPythonFreeRunHarnessSource()
          : buildPythonHarnessSource(request.functionName),
        {
          encoding: "utf8",
          mode: 0o600,
        },
      ),
    ]);

    const result = await new Promise<CodeRunResult>((resolve) => {
      const child = spawn(PYTHON_EXECUTABLE, ["-I", "-B", harnessPath], {
        cwd: runDir,
        shell: false,
        env: {
          NODE_ENV: "development",
          PYTHONDONTWRITEBYTECODE: "1",
          PYTHONIOENCODING: "utf-8",
        },
      }) as ChildProcessWithoutNullStreams;

      let stdout = "";
      let stderr = "";
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, RUN_TIMEOUT_MS);

      child.stdout.on("data", (chunk: Buffer) => {
        stdout = collectLimitedOutput(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = collectLimitedOutput(stderr, chunk);
      });
      child.on("error", (error) => {
        clearTimeout(timer);
        resolve(
          createCodeRunResult({
            status: "RuntimeError",
            stderr,
            errorMessage: sanitizeRunnerErrorMessage(error),
            runtimeMs: Math.round(performance.now() - started),
          }),
        );
      });
      child.on("close", () => {
        clearTimeout(timer);

        if (timedOut) {
          resolve(
            createCodeRunResult({
              status: "TimedOut",
              stdout,
              stderr,
              errorMessage: `Code execution exceeded ${RUN_TIMEOUT_MS}ms.`,
              runtimeMs: Math.round(performance.now() - started),
            }),
          );
          return;
        }

        const payload = safeParseHarnessPayload(stdout);

        if (!payload) {
          resolve(
            createCodeRunResult({
              status: "RuntimeError",
              stdout,
              stderr,
              errorMessage:
                "Python runner did not return a valid structured result.",
              runtimeMs: Math.round(performance.now() - started),
            }),
          );
          return;
        }

        resolve(
          createCodeRunResult({
            status: payload.status ?? "RuntimeError",
            stdout: payload.stdout ?? "",
            stderr: truncateOutput(
              [payload.stderr ?? "", stderr].filter(Boolean).join("\n"),
            ),
            errorMessage: payload.errorMessage,
            runtimeMs: Math.round(performance.now() - started),
            testResults: payload.testResults ?? [],
          }),
        );
      });

      child.stdin.end(
        JSON.stringify({
          tests: request.runType === "FreeRun" ? [] : request.tests,
        }),
      );
    });

    return result;
  } finally {
    await rm(runDir, { force: true, recursive: true }).catch(() => undefined);
  }
}
