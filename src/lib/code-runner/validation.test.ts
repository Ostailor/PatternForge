import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_CODE_LENGTH,
  MAX_TEST_EXPECTED_OUTPUT_SIZE,
  MAX_TEST_INPUT_SIZE,
  MAX_TESTS_PER_RUN,
} from "@/lib/code-runner/limits";
import { validateCodeRunRequest } from "@/lib/code-runner/validation";

function invalidMessage(input: Parameters<typeof validateCodeRunRequest>[0]) {
  const result = validateCodeRunRequest(input);

  assert.equal(result.ok, false);

  return result.ok ? "" : result.errorMessage;
}

test("validateCodeRunRequest accepts safe Python custom test payloads", () => {
  const result = validateCodeRunRequest({
    language: "Python",
    code: "def solve(value):\n    return value\n",
    functionName: "solve",
    runType: "CustomTests",
    tests: [
      {
        name: "echoes input",
        inputJson: [1],
        expectedOutputJson: 1,
      },
    ],
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.request.language, "Python");
    assert.equal(result.request.functionName, "solve");
    assert.equal(result.request.tests.length, 1);
  }
});

test("validateCodeRunRequest rejects unsafe or oversized code runner inputs", () => {
  assert.match(
    invalidMessage({
      language: "JavaScript",
      code: "function solve() {}",
      tests: [],
    }),
    /Unsupported language/,
  );
  assert.equal(
    invalidMessage({
      language: "Python",
      code: "x".repeat(MAX_CODE_LENGTH + 1),
      tests: [],
    }),
    `Code must be ${MAX_CODE_LENGTH.toLocaleString()} characters or fewer.`,
  );
  assert.match(
    invalidMessage({
      language: "Python",
      code: "def solve():\n    return 1\n",
      functionName: "solve; import os",
      tests: [],
    }),
    /valid Python identifier/,
  );
  assert.equal(
    invalidMessage({
      language: "Python",
      code: "def solve():\n    return 1\n",
      tests: Array.from({ length: MAX_TESTS_PER_RUN + 1 }, (_, index) => ({
        name: `case ${index}`,
        inputJson: [],
        expectedOutputJson: null,
      })),
    }),
    `A run can include at most ${MAX_TESTS_PER_RUN} tests.`,
  );
  assert.equal(
    invalidMessage({
      language: "Python",
      code: "def solve(value):\n    return value\n",
      tests: [
        {
          name: "large input",
          inputJson: "x".repeat(MAX_TEST_INPUT_SIZE + 1),
          expectedOutputJson: null,
        },
      ],
    }),
    `Each test input must be ${MAX_TEST_INPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
  );
  assert.equal(
    invalidMessage({
      language: "Python",
      code: "def solve(value):\n    return value\n",
      tests: [
        {
          name: "large expected",
          inputJson: null,
          expectedOutputJson: "x".repeat(MAX_TEST_EXPECTED_OUTPUT_SIZE + 1),
        },
      ],
    }),
    `Each expected output must be ${MAX_TEST_EXPECTED_OUTPUT_SIZE.toLocaleString()} characters or fewer after JSON serialization.`,
  );
});

test("validateCodeRunRequest keeps free run validation separate from structured tests", () => {
  const result = validateCodeRunRequest({
    language: "Python",
    code: "print('manual run')",
    runType: "FreeRun",
  });

  assert.equal(result.ok, true);

  if (result.ok) {
    assert.equal(result.request.runType, "FreeRun");
    assert.deepEqual(result.request.tests, []);
  }
});
