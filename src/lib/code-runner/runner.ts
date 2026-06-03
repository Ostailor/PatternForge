import { runPythonCode } from "@/lib/code-runner/pythonRunner";
import {
  getRunnerConfig,
  runStructuredTests,
} from "@/lib/code-runner/runnerConfig";
import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import { createCodeRunResult } from "@/lib/code-runner/results";
import type { CodeRunRequest, CodeRunResult } from "@/lib/code-runner/types";
import { validateCodeRunRequest } from "@/lib/code-runner/validation";

export async function runCode(input: CodeRunRequest): Promise<CodeRunResult> {
  const validation = validateCodeRunRequest(input);

  if (!validation.ok) {
    return validation;
  }

  switch (validation.request.language) {
    case "Python": {
      if (
        validation.request.runType !== "FreeRun" &&
        !input.functionName
      ) {
        if (!input.problemId) {
          return createCodeRunResult({
            status: "ValidationError",
            errorMessage: STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE,
          });
        }

        const config = await getRunnerConfig(input.problemId, input.language);

        return runStructuredTests(
          validation.request.code,
          config,
          validation.request.tests,
        );
      }

      return runPythonCode(validation.request);
    }
    default:
      return createCodeRunResult({
        status: "ValidationError",
        errorMessage: "Unsupported language. PatternForge v0.7 supports Python only.",
      });
  }
}
