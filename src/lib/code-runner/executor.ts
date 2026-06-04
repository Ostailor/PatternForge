import {
  CODE_RUNNER_DISABLED_MESSAGE,
  CODE_RUNNER_LOCAL_DEV_ONLY_MESSAGE,
  CODE_RUNNER_SANDBOX_NOT_CONFIGURED_MESSAGE,
  disabledCodeRunResult,
  getCodeRunnerMode,
} from "@/lib/code-runner/mode";
import { runPythonCode } from "@/lib/code-runner/pythonRunner";
import { getCodeRunnerSandboxProvider } from "@/lib/code-runner/sandboxProvider";
import type { CodeRunResult, ValidatedCodeRunRequest } from "@/lib/code-runner/types";

export function getCodeExecutionUnavailableMessage(): string | null {
  const mode = getCodeRunnerMode();

  if (mode === "disabled") {
    return CODE_RUNNER_DISABLED_MESSAGE;
  }

  if (mode === "local-dev" && process.env.NODE_ENV === "production") {
    return CODE_RUNNER_LOCAL_DEV_ONLY_MESSAGE;
  }

  if (mode === "sandbox" && !getCodeRunnerSandboxProvider()) {
    return CODE_RUNNER_SANDBOX_NOT_CONFIGURED_MESSAGE;
  }

  return null;
}

export function isCodeExecutionAvailable(): boolean {
  return getCodeExecutionUnavailableMessage() === null;
}

export async function executeValidatedCodeRun(
  request: ValidatedCodeRunRequest,
): Promise<CodeRunResult> {
  const unavailableMessage = getCodeExecutionUnavailableMessage();

  if (unavailableMessage) {
    return disabledCodeRunResult(unavailableMessage);
  }

  if (getCodeRunnerMode() === "sandbox") {
    const provider = getCodeRunnerSandboxProvider();

    return provider
      ? provider.run(request)
      : disabledCodeRunResult(CODE_RUNNER_SANDBOX_NOT_CONFIGURED_MESSAGE);
  }

  return runPythonCode(request);
}
