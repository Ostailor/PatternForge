import {
  MAX_CODE_LENGTH,
  MAX_TEST_EXPECTED_OUTPUT_SIZE,
  MAX_TEST_INPUT_SIZE,
  MAX_TESTS_PER_RUN,
} from "@/lib/code-runner/limits";
import type {
  CodeRunRequest,
  CodeRunType,
  ValidationResult,
} from "@/lib/code-runner/types";

const SUPPORTED_LANGUAGES = new Set(["Python"]);
const SUPPORTED_RUN_TYPES = new Set<CodeRunType>([
  "CustomTests",
  "SmokeTest",
  "FreeRun",
]);
const FUNCTION_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MAX_TEST_NAME_LENGTH = 200;

function validationError(errorMessage: string): ValidationResult {
  return {
    ok: false,
    status: "ValidationError",
    stdout: "",
    stderr: "",
    errorMessage,
    testResults: [],
  };
}

function serializedSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function isSupportedRunType(value: unknown): value is CodeRunType {
  return (
    value === undefined ||
    (typeof value === "string" && SUPPORTED_RUN_TYPES.has(value as CodeRunType))
  );
}

export function validateCodeRunRequest(
  input: CodeRunRequest,
): ValidationResult {
  if (typeof input !== "object" || input === null) {
    return validationError("Code run request must be an object.");
  }

  const runType = input.runType ?? "CustomTests";

  if (typeof input.language !== "string" || !SUPPORTED_LANGUAGES.has(input.language)) {
    return validationError("Unsupported language. PatternForge v0.7 supports Python only.");
  }

  if (typeof input.code !== "string" || input.code.trim().length === 0) {
    return validationError("Code is required.");
  }

  if (input.code.length > MAX_CODE_LENGTH) {
    return validationError(
      `Code must be ${MAX_CODE_LENGTH.toLocaleString()} characters or fewer.`,
    );
  }

  if (!isSupportedRunType(runType)) {
    return validationError("Unsupported run type.");
  }

  if (runType === "FreeRun") {
    return {
      ok: true,
      request: {
        ...input,
        language: "Python",
        functionName: input.functionName ?? "solve",
        tests: [],
        runType,
      },
    };
  }

  if (input.functionName && !FUNCTION_NAME_PATTERN.test(input.functionName)) {
    return validationError(
      "Function name must be a valid Python identifier such as solve.",
    );
  }

  if (!Array.isArray(input.tests)) {
    return validationError("Tests must be provided as a list.");
  }

  if (input.tests.length > MAX_TESTS_PER_RUN) {
    return validationError(
      `A run can include at most ${MAX_TESTS_PER_RUN} tests.`,
    );
  }

  for (const test of input.tests) {
    if (typeof test.name !== "string" || !test.name.trim()) {
      return validationError("Every test needs a name.");
    }

    if (test.name.length > MAX_TEST_NAME_LENGTH) {
      return validationError(
        `Test names must be ${MAX_TEST_NAME_LENGTH} characters or fewer.`,
      );
    }

    if (serializedSize(test.inputJson) > MAX_TEST_INPUT_SIZE) {
      return validationError(
        `Each test input must be ${MAX_TEST_INPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
      );
    }

    if (serializedSize(test.expectedOutputJson) > MAX_TEST_EXPECTED_OUTPUT_SIZE) {
      return validationError(
        `Each expected output must be ${MAX_TEST_EXPECTED_OUTPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
      );
    }
  }

  return {
    ok: true,
    request: {
      ...input,
      language: "Python",
      functionName: input.functionName ?? "solve",
      tests: input.tests,
      runType,
    },
  };
}
