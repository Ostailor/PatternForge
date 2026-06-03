export const MAX_CODE_LENGTH = 20_000;
export const MAX_TEST_INPUT_SIZE = 10_000;
export const MAX_TEST_EXPECTED_OUTPUT_SIZE = 10_000;
export const MAX_TESTS_PER_RUN = 10;
export const MAX_OUTPUT_CAPTURE = 10_000;
export const RUN_TIMEOUT_MS = 3_000;

export const PYTHON_EXECUTABLE =
  process.env.PATTERNFORGE_PYTHON_BIN?.trim() || "python3";
