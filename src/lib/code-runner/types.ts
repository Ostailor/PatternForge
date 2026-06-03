export type SupportedCodeLanguage = "Python";

export type CodeRunType = "CustomTests" | "SmokeTest" | "FreeRun";

export type CodeRunStatus =
  | "Queued"
  | "Running"
  | "Succeeded"
  | "Failed"
  | "TimedOut"
  | "RuntimeError"
  | "ValidationError";

export type CodeRunnerTestCase = {
  testCaseId?: string;
  name: string;
  inputJson: unknown;
  expectedOutputJson: unknown;
};

export type JsonSchemaSubset = {
  type?: "array" | "object" | "string" | "number" | "integer" | "boolean" | "null";
  items?: JsonSchemaSubset;
  prefixItems?: JsonSchemaSubset[];
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchemaSubset>;
  required?: string[];
};

export type ProblemRunnerConfigData = {
  id?: string;
  problemId: string;
  language: SupportedCodeLanguage;
  functionName: string;
  inputSchema: JsonSchemaSubset;
  outputSchema: JsonSchemaSubset;
  harnessTemplate: string;
  isEnabled: boolean;
};

export type CodeRunRequest = {
  problemId?: string;
  language: string;
  code: string;
  functionName?: string;
  tests?: CodeRunnerTestCase[];
  runType?: CodeRunType;
};

export type ValidatedCodeRunRequest = CodeRunRequest & {
  language: SupportedCodeLanguage;
  functionName: string;
  tests: CodeRunnerTestCase[];
  runType: CodeRunType;
};

export type TestExecutionResult = {
  testCaseId?: string;
  name: string;
  inputJson: unknown;
  expectedOutputJson: unknown;
  actualOutputJson?: unknown;
  passed: boolean;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
  runtimeMs?: number;
};

export type CodeRunResult = {
  status: CodeRunStatus;
  stdout: string;
  stderr: string;
  errorMessage?: string;
  runtimeMs?: number;
  testResults: TestExecutionResult[];
};

export type ValidationResult =
  | { ok: true; request: ValidatedCodeRunRequest }
  | {
      ok: false;
      status: "ValidationError";
      stdout: "";
      stderr: "";
      errorMessage: string;
      runtimeMs?: undefined;
      testResults: [];
    };
