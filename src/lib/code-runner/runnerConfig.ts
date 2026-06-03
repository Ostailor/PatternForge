import {
  CodeLanguage as PrismaCodeLanguage,
  type Prisma,
} from "@/generated/prisma/client";
import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import { runPythonCode } from "@/lib/code-runner/pythonRunner";
import { createCodeRunResult } from "@/lib/code-runner/results";
import { buildPythonHarnessSource } from "@/lib/code-runner/testHarness";
import type {
  CodeRunnerTestCase,
  JsonSchemaSubset,
  ProblemRunnerConfigData,
  SupportedCodeLanguage,
} from "@/lib/code-runner/types";
import { getPrisma } from "@/lib/prisma";

type SchemaValidationResult =
  | { ok: true }
  | { ok: false; errorMessage: string };

function toSupportedLanguage(language: string): SupportedCodeLanguage | null {
  return language === "Python" ? "Python" : null;
}

function toPrismaCodeLanguage(language: SupportedCodeLanguage): PrismaCodeLanguage {
  switch (language) {
    case "Python":
      return PrismaCodeLanguage.Python;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toJsonSchemaSubset(value: Prisma.JsonValue): JsonSchemaSubset {
  return isRecord(value) ? (value as JsonSchemaSubset) : {};
}

function toRunnerConfigData(config: {
  id: string;
  problemId: string;
  language: PrismaCodeLanguage;
  functionName: string;
  inputSchema: Prisma.JsonValue;
  outputSchema: Prisma.JsonValue;
  harnessTemplate: string;
  isEnabled: boolean;
}): ProblemRunnerConfigData {
  return {
    id: config.id,
    problemId: config.problemId,
    language: "Python",
    functionName: config.functionName,
    inputSchema: toJsonSchemaSubset(config.inputSchema),
    outputSchema: toJsonSchemaSubset(config.outputSchema),
    harnessTemplate: config.harnessTemplate,
    isEnabled: config.isEnabled,
  };
}

export async function getRunnerConfig(
  problemId: string,
  language: string,
): Promise<ProblemRunnerConfigData | null> {
  const supportedLanguage = toSupportedLanguage(language);

  if (!problemId.trim() || !supportedLanguage) {
    return null;
  }

  const config = await getPrisma().problemRunnerConfig.findFirst({
    where: {
      problemId,
      language: toPrismaCodeLanguage(supportedLanguage),
      isEnabled: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  return config ? toRunnerConfigData(config) : null;
}

function typeName(value: unknown): string {
  if (Array.isArray(value)) {
    return "array";
  }

  if (value === null) {
    return "null";
  }

  if (Number.isInteger(value)) {
    return "integer";
  }

  return typeof value;
}

function validateAgainstSchema(
  schema: JsonSchemaSubset,
  value: unknown,
  pathName: string,
): SchemaValidationResult {
  if (!schema.type) {
    return { ok: true };
  }

  const actualType = typeName(value);
  const typeMatches =
    schema.type === actualType ||
    (schema.type === "number" && actualType === "integer");

  if (!typeMatches) {
    return {
      ok: false,
      errorMessage: `${pathName} must be ${schema.type}; received ${actualType}.`,
    };
  }

  if (schema.type === "array") {
    if (!Array.isArray(value)) {
      return { ok: false, errorMessage: `${pathName} must be an array.` };
    }

    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      return {
        ok: false,
        errorMessage: `${pathName} must include at least ${schema.minItems} items.`,
      };
    }

    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      return {
        ok: false,
        errorMessage: `${pathName} must include at most ${schema.maxItems} items.`,
      };
    }

    for (const [index, itemSchema] of (schema.prefixItems ?? []).entries()) {
      const result = validateAgainstSchema(
        itemSchema,
        value[index],
        `${pathName}[${index}]`,
      );

      if (!result.ok) {
        return result;
      }
    }

    if (schema.items) {
      for (const [index, item] of value.entries()) {
        const result = validateAgainstSchema(
          schema.items,
          item,
          `${pathName}[${index}]`,
        );

        if (!result.ok) {
          return result;
        }
      }
    }
  }

  if (schema.type === "object" && schema.properties) {
    if (!isRecord(value)) {
      return { ok: false, errorMessage: `${pathName} must be an object.` };
    }

    for (const requiredKey of schema.required ?? []) {
      if (!(requiredKey in value)) {
        return {
          ok: false,
          errorMessage: `${pathName}.${requiredKey} is required.`,
        };
      }
    }

    for (const [key, childSchema] of Object.entries(schema.properties)) {
      if (!(key in value)) {
        continue;
      }

      const result = validateAgainstSchema(
        childSchema,
        value[key],
        `${pathName}.${key}`,
      );

      if (!result.ok) {
        return result;
      }
    }
  }

  return { ok: true };
}

export function validateJsonValueAgainstSchema(
  schema: JsonSchemaSubset,
  value: unknown,
  label: string,
): SchemaValidationResult {
  return validateAgainstSchema(schema, value, label);
}

export function validateTestInputAgainstSchema(
  config: ProblemRunnerConfigData,
  inputJson: unknown,
): SchemaValidationResult {
  return validateAgainstSchema(config.inputSchema, inputJson, "inputJson");
}

export function validateTestOutputAgainstSchema(
  config: ProblemRunnerConfigData,
  expectedOutputJson: unknown,
): SchemaValidationResult {
  return validateAgainstSchema(
    config.outputSchema,
    expectedOutputJson,
    "expectedOutputJson",
  );
}

export function buildPythonHarness(
  userCode: string,
  config: ProblemRunnerConfigData,
  testCases: CodeRunnerTestCase[],
): string {
  return [
    `# PatternForge harness template: ${config.harnessTemplate}`,
    "# PatternForge-owned glue only: loads user code and calls the configured function with JSON inputs.",
    userCode,
    "",
    buildPythonHarnessSource(config.functionName),
    `# Structured test count: ${testCases.length}`,
  ].join("\n");
}

export async function runStructuredTests(
  userCode: string,
  config: ProblemRunnerConfigData | null,
  testCases: CodeRunnerTestCase[],
) {
  if (!config) {
    return createCodeRunResult({
      status: "ValidationError",
      errorMessage: STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE,
    });
  }

  for (const testCase of testCases) {
    const validation = validateTestInputAgainstSchema(config, testCase.inputJson);

    if (!validation.ok) {
      return createCodeRunResult({
        status: "ValidationError",
        errorMessage: validation.errorMessage,
      });
    }

    const outputValidation = validateTestOutputAgainstSchema(
      config,
      testCase.expectedOutputJson,
    );

    if (!outputValidation.ok) {
      return createCodeRunResult({
        status: "ValidationError",
        errorMessage: outputValidation.errorMessage,
      });
    }
  }

  return runPythonCode({
    language: config.language,
    code: userCode,
    functionName: config.functionName,
    tests: testCases,
    runType: "CustomTests",
  });
}
