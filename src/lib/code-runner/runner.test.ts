import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CODE_LENGTH,
  MAX_TEST_EXPECTED_OUTPUT_SIZE,
  MAX_TESTS_PER_RUN,
  MAX_TEST_INPUT_SIZE,
} from "@/lib/code-runner/limits";
import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import { runCode } from "@/lib/code-runner/runner";
import type { ValidationResult } from "@/lib/code-runner/types";
import { validateCodeRunRequest } from "@/lib/code-runner/validation";

function assertInvalid(result: ValidationResult) {
  assert.equal(result.ok, false);

  if (result.ok) {
    throw new Error("Expected validation to fail.");
  }

  return result;
}

test("validation rejects unsupported languages and over-limit payloads", () => {
  assert.equal(
    assertInvalid(
      validateCodeRunRequest({
        language: "JavaScript",
        code: "function solve() {}",
        functionName: "solve",
        tests: [],
      }),
    ).status,
    "ValidationError",
  );

  assert.equal(
    assertInvalid(
      validateCodeRunRequest({
        language: "Python",
        code: "x".repeat(MAX_CODE_LENGTH + 1),
        functionName: "solve",
        tests: [],
      }),
    ).errorMessage,
    `Code must be ${MAX_CODE_LENGTH.toLocaleString()} characters or fewer.`,
  );

  assert.equal(
    assertInvalid(
      validateCodeRunRequest({
        language: "Python",
        code: "def solve(): pass",
        functionName: "solve",
        tests: Array.from({ length: MAX_TESTS_PER_RUN + 1 }, (_, index) => ({
          name: `case ${index}`,
          inputJson: [],
          expectedOutputJson: null,
        })),
      }),
    ).errorMessage,
    `A run can include at most ${MAX_TESTS_PER_RUN} tests.`,
  );

  assert.equal(
    assertInvalid(
      validateCodeRunRequest({
        language: "Python",
        code: "def solve(value): return value",
        functionName: "solve",
        tests: [
          {
            name: "large input",
            inputJson: "x".repeat(MAX_TEST_INPUT_SIZE + 1),
            expectedOutputJson: null,
          },
        ],
      }),
    ).errorMessage,
    `Each test input must be ${MAX_TEST_INPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
  );

  assert.equal(
    assertInvalid(
      validateCodeRunRequest({
        language: "Python",
        code: "def solve(value): return value",
        functionName: "solve",
        tests: [
          {
            name: "large expected output",
            inputJson: null,
            expectedOutputJson: "x".repeat(MAX_TEST_EXPECTED_OUTPUT_SIZE + 1),
          },
        ],
      }),
    ).errorMessage,
    `Each expected output must be ${MAX_TEST_EXPECTED_OUTPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
  );
});

test("python runner returns structured success and failure results", async () => {
  const result = await runCode({
    language: "Python",
    code: "def solve(value):\n    print('case', value)\n    return value * 2\n",
    functionName: "solve",
    tests: [
      { name: "passes", inputJson: [3], expectedOutputJson: 6 },
      { name: "fails", inputJson: [4], expectedOutputJson: 9 },
    ],
  });

  assert.equal(result.status, "Failed");
  assert.match(result.stdout, /case 3/);
  assert.equal(result.testResults.length, 2);
  assert.equal(result.testResults[0]?.passed, true);
  assert.equal(result.testResults[1]?.passed, false);
  assert.deepEqual(result.testResults[1]?.actualOutputJson, 8);
});

test("python runner handles syntax errors and runtime errors", async () => {
  const syntaxResult = await runCode({
    language: "Python",
    code: "def solve(:\n    return 1\n",
    functionName: "solve",
    tests: [{ name: "case", inputJson: [], expectedOutputJson: 1 }],
  });

  assert.equal(syntaxResult.status, "RuntimeError");
  assert.match(syntaxResult.errorMessage ?? "", /SyntaxError/);

  const runtimeResult = await runCode({
    language: "Python",
    code: "def solve():\n    raise ValueError('bad input')\n",
    functionName: "solve",
    tests: [{ name: "case", inputJson: [], expectedOutputJson: 1 }],
  });

  assert.equal(runtimeResult.status, "RuntimeError");
  assert.equal(runtimeResult.testResults[0]?.passed, false);
  assert.match(runtimeResult.testResults[0]?.errorMessage ?? "", /ValueError/);
});

test("python runner times out and caps output", async () => {
  const timeoutResult = await runCode({
    language: "Python",
    code: "def solve():\n    while True:\n        pass\n",
    functionName: "solve",
    tests: [{ name: "loop", inputJson: [], expectedOutputJson: null }],
  });

  assert.equal(timeoutResult.status, "TimedOut");

  const noisyResult = await runCode({
    language: "Python",
    code: "def solve():\n    print('x' * 20000)\n    return 1\n",
    functionName: "solve",
    tests: [{ name: "noisy", inputJson: [], expectedOutputJson: 1 }],
  });

  assert.equal(noisyResult.status, "Succeeded");
  assert.ok(noisyResult.stdout.length <= 10000);
  assert.match(noisyResult.stdout, /truncated/);
});

test("python runner blocks accidental network and outside-file access", async () => {
  const networkResult = await runCode({
    language: "Python",
    code: [
      "def solve():",
      "    import socket",
      "    socket.socket(socket.AF_INET, socket.SOCK_STREAM)",
      "    return True",
    ].join("\n"),
    functionName: "solve",
    tests: [{ name: "network", inputJson: [], expectedOutputJson: true }],
  });

  assert.equal(networkResult.status, "RuntimeError");
  assert.match(
    networkResult.testResults[0]?.errorMessage ?? "",
    /Network access is disabled/,
  );

  const fileResult = await runCode({
    language: "Python",
    code: [
      "def solve():",
      "    with open('/etc/passwd', 'r') as handle:",
      "        return handle.read()",
    ].join("\n"),
    functionName: "solve",
    tests: [{ name: "file", inputJson: [], expectedOutputJson: "" }],
  });

  assert.equal(fileResult.status, "RuntimeError");
  assert.match(
    fileResult.testResults[0]?.errorMessage ?? "",
    /File access is limited/,
  );

  const subprocessResult = await runCode({
    language: "Python",
    code: [
      "def solve():",
      "    import subprocess",
      "    subprocess.run(['echo', 'nope'])",
      "    return True",
    ].join("\n"),
    functionName: "solve",
    tests: [{ name: "subprocess", inputJson: [], expectedOutputJson: true }],
  });

  assert.equal(subprocessResult.status, "RuntimeError");
  assert.match(
    subprocessResult.testResults[0]?.errorMessage ?? "",
    /subprocess is disabled/,
  );
});

test("free run executes a full script without structured tests", async () => {
  const result = await runCode({
    language: "Python",
    code: "print('free run still available')",
    runType: "FreeRun",
  });

  assert.equal(result.status, "Succeeded");
  assert.match(result.stdout, /free run still available/);
  assert.equal(result.testResults.length, 0);
});

test("structured run without a problem config returns the configured fallback message", async () => {
  const result = await runCode({
    language: "Python",
    code: "def solve():\n    return 1\n",
    runType: "CustomTests",
    tests: [],
  });

  assert.equal(result.status, "ValidationError");
  assert.equal(result.errorMessage, STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE);
});
