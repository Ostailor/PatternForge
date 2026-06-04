import { createCodeRunResult } from "@/lib/code-runner/results";
import type { CodeRunResult } from "@/lib/code-runner/types";

export type CodeRunnerMode = "disabled" | "local-dev" | "sandbox";

const allowedModes = new Set<CodeRunnerMode>([
  "disabled",
  "local-dev",
  "sandbox",
]);

export const CODE_RUNNER_DISABLED_MESSAGE =
  "Code execution is disabled in this environment. You can still edit and save code.";

export const CODE_RUNNER_LOCAL_DEV_ONLY_MESSAGE =
  "Local code execution is development-only and is disabled in production. Configure CODE_RUNNER_MODE=sandbox with an isolated sandbox provider.";

export const CODE_RUNNER_SANDBOX_NOT_CONFIGURED_MESSAGE =
  "Code execution requires a configured production sandbox provider. You can still edit and save code.";

export function getCodeRunnerMode(): CodeRunnerMode {
  const rawMode = process.env.CODE_RUNNER_MODE?.trim();

  if (!rawMode) {
    return process.env.NODE_ENV === "production" ? "disabled" : "local-dev";
  }

  return allowedModes.has(rawMode as CodeRunnerMode)
    ? (rawMode as CodeRunnerMode)
    : "disabled";
}

export function isLocalDevCodeRunnerAllowed(): boolean {
  return getCodeRunnerMode() === "local-dev" && process.env.NODE_ENV !== "production";
}

export function disabledCodeRunResult(errorMessage: string): CodeRunResult {
  return createCodeRunResult({
    status: "ValidationError",
    errorMessage,
  });
}
