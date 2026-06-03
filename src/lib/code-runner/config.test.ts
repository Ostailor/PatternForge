import assert from "node:assert/strict";
import test from "node:test";

import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import {
  buildPythonHarness,
  runStructuredTests,
  validateTestInputAgainstSchema,
} from "@/lib/code-runner/runnerConfig";
import type { ProblemRunnerConfigData } from "@/lib/code-runner/types";

const twoArgConfig: ProblemRunnerConfigData = {
  id: "config-1",
  problemId: "patternforge-sample",
  language: "Python",
  functionName: "solve",
  inputSchema: {
    type: "array",
    minItems: 2,
    maxItems: 2,
    prefixItems: [
      { type: "array", items: { type: "number" } },
      { type: "number" },
    ],
  },
  outputSchema: {
    type: "array",
    items: { type: "number" },
  },
  harnessTemplate: "patternforge-python-json-v1",
  isEnabled: true,
};

test("validates structured runner input against the configured schema subset", () => {
  assert.equal(
    validateTestInputAgainstSchema(twoArgConfig, [[2, 7, 11], 9]).ok,
    true,
  );

  const invalid = validateTestInputAgainstSchema(twoArgConfig, [[2, 7, 11]]);

  assert.equal(invalid.ok, false);
  assert.match(invalid.errorMessage, /at least 2 items/);
});

test("builds PatternForge-owned Python harness source from config metadata", () => {
  const harness = buildPythonHarness(
    "def solve(nums, target):\n    return [0, 1]\n",
    twoArgConfig,
    [
      {
        name: "patternforge custom case",
        inputJson: [[2, 7], 9],
        expectedOutputJson: [0, 1],
      },
    ],
  );

  assert.match(harness, /def solve/);
  assert.match(harness, /patternforge-python-json-v1/);
  assert.doesNotMatch(harness, /leetcode/i);
});

test("runs structured tests using config function metadata", async () => {
  const result = await runStructuredTests(
    "def solve(nums, target):\n    return [0, 1]\n",
    twoArgConfig,
    [
      {
        name: "custom case",
        inputJson: [[2, 7], 9],
        expectedOutputJson: [0, 1],
      },
    ],
  );

  assert.equal(result.status, "Succeeded");
  assert.equal(result.testResults[0]?.passed, true);
});

test("structured run returns clear fallback message when no config exists", async () => {
  const result = await runStructuredTests(
    "print('free run still available')",
    null,
    [],
  );

  assert.equal(result.status, "ValidationError");
  assert.equal(result.errorMessage, STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE);
});
