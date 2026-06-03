import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { patterns } from "../src/data/patterns";
import { problems } from "../src/data/problems";
import {
  CodeLanguage,
  Difficulty,
  PrismaClient,
  type Prisma,
} from "../src/generated/prisma/client";
import { achievementDefinitions } from "../src/lib/achievements/definitions";
import type { Problem as SeedProblem } from "../src/lib/types";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const PYTHON_JSON_HARNESS_TEMPLATE = "patternforge-python-json-v1";

const beginnerRunnerConfigs: Array<{
  problemId: string;
  language: CodeLanguage;
  functionName: string;
  inputSchema: Prisma.InputJsonObject;
  outputSchema: Prisma.InputJsonObject;
  harnessTemplate: string;
}> = [
  {
    problemId: "two-sum",
    language: CodeLanguage.Python,
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
      items: { type: "integer" },
    },
    harnessTemplate: PYTHON_JSON_HARNESS_TEMPLATE,
  },
  {
    problemId: "valid-anagram",
    language: CodeLanguage.Python,
    functionName: "solve",
    inputSchema: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      prefixItems: [{ type: "string" }, { type: "string" }],
    },
    outputSchema: { type: "boolean" },
    harnessTemplate: PYTHON_JSON_HARNESS_TEMPLATE,
  },
  {
    problemId: "contains-duplicate",
    language: CodeLanguage.Python,
    functionName: "solve",
    inputSchema: {
      type: "array",
      minItems: 1,
      maxItems: 1,
      prefixItems: [{ type: "array", items: { type: "number" } }],
    },
    outputSchema: { type: "boolean" },
    harnessTemplate: PYTHON_JSON_HARNESS_TEMPLATE,
  },
  {
    problemId: "binary-search",
    language: CodeLanguage.Python,
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
    outputSchema: { type: "integer" },
    harnessTemplate: PYTHON_JSON_HARNESS_TEMPLATE,
  },
];

function toDifficulty(difficulty: SeedProblem["difficulty"]): Difficulty {
  switch (difficulty) {
    case "Easy":
      return Difficulty.Easy;
    case "Medium":
      return Difficulty.Medium;
    case "Hard":
      return Difficulty.Hard;
  }
}

function validateSeedData(): void {
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const problemIds = new Set<string>();

  if (patternIds.size !== patterns.length) {
    throw new Error("Seed patterns must have unique IDs.");
  }

  for (const pattern of patterns) {
    if (!pattern.name.trim()) {
      throw new Error(`Pattern ${pattern.id} is missing a name.`);
    }
  }

  for (const problem of problems) {
    if (problemIds.has(problem.id)) {
      throw new Error(`Duplicate problem ID in seed data: ${problem.id}`);
    }

    problemIds.add(problem.id);

    if (!problem.url.startsWith("https://leetcode.com/problems/")) {
      throw new Error(
        `Problem ${problem.id} must use a LeetCode problem URL only.`,
      );
    }

    if (!patternIds.has(problem.primaryPatternId)) {
      throw new Error(
        `Problem ${problem.id} references unknown primary pattern ${problem.primaryPatternId}.`,
      );
    }

    const secondaryPatternIds = new Set(problem.secondaryPatternIds);

    if (secondaryPatternIds.size !== problem.secondaryPatternIds.length) {
      throw new Error(
        `Problem ${problem.id} has duplicate secondary pattern IDs.`,
      );
    }

    if (secondaryPatternIds.has(problem.primaryPatternId)) {
      throw new Error(
        `Problem ${problem.id} cannot repeat its primary pattern as secondary.`,
      );
    }

    for (const patternId of problem.secondaryPatternIds) {
      if (!patternIds.has(patternId)) {
        throw new Error(
          `Problem ${problem.id} references unknown secondary pattern ${patternId}.`,
        );
      }
    }
  }

  const runnerConfigKeys = new Set<string>();

  for (const config of beginnerRunnerConfigs) {
    if (!problemIds.has(config.problemId)) {
      throw new Error(
        `Runner config references unknown problem ${config.problemId}.`,
      );
    }

    const key = `${config.problemId}:${config.language}`;

    if (runnerConfigKeys.has(key)) {
      throw new Error(`Duplicate runner config in seed data: ${key}`);
    }

    runnerConfigKeys.add(key);
  }
}

async function main(): Promise<void> {
  validateSeedData();

  await prisma.$transaction(async (tx) => {
    for (const pattern of patterns) {
      await tx.pattern.upsert({
        where: { id: pattern.id },
        update: {
          name: pattern.name,
          category: pattern.category,
          description: pattern.description,
          recognitionClues: pattern.recognitionClues,
          templateSummary: pattern.templateSummary,
          commonMistakes: pattern.commonMistakes,
          levelOrder: pattern.levelOrder,
        },
        create: {
          id: pattern.id,
          name: pattern.name,
          category: pattern.category,
          description: pattern.description,
          recognitionClues: pattern.recognitionClues,
          templateSummary: pattern.templateSummary,
          commonMistakes: pattern.commonMistakes,
          levelOrder: pattern.levelOrder,
        },
      });
    }

    for (const problem of problems) {
      await tx.problem.upsert({
        where: { id: problem.id },
        update: {
          title: problem.title,
          url: problem.url,
          difficulty: toDifficulty(problem.difficulty),
          estimatedMinutes: problem.estimatedMinutes,
          recognitionClues: problem.recognitionClues,
          commonMistakes: problem.commonMistakes,
        },
        create: {
          id: problem.id,
          title: problem.title,
          url: problem.url,
          difficulty: toDifficulty(problem.difficulty),
          estimatedMinutes: problem.estimatedMinutes,
          recognitionClues: problem.recognitionClues,
          commonMistakes: problem.commonMistakes,
        },
      });

      await tx.problemPattern.upsert({
        where: {
          problemId_patternId: {
            problemId: problem.id,
            patternId: problem.primaryPatternId,
          },
        },
        update: { isPrimary: true },
        create: {
          problemId: problem.id,
          patternId: problem.primaryPatternId,
          isPrimary: true,
        },
      });

      for (const patternId of problem.secondaryPatternIds) {
        await tx.problemPattern.upsert({
          where: {
            problemId_patternId: {
              problemId: problem.id,
              patternId,
            },
          },
          update: { isPrimary: false },
          create: {
            problemId: problem.id,
            patternId,
            isPrimary: false,
          },
        });
      }
    }

    for (const achievement of achievementDefinitions) {
      await tx.achievement.upsert({
        where: { key: achievement.key },
        update: {
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
        },
        create: {
          key: achievement.key,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          xpReward: achievement.xpReward,
        },
      });
    }

    for (const config of beginnerRunnerConfigs) {
      const result = await tx.problemRunnerConfig.updateMany({
        where: {
          problemId: config.problemId,
          language: config.language,
        },
        data: {
          functionName: config.functionName,
          inputSchema: config.inputSchema,
          outputSchema: config.outputSchema,
          harnessTemplate: config.harnessTemplate,
          isEnabled: true,
        },
      });

      if (result.count === 0) {
        await tx.problemRunnerConfig.create({
          data: {
            ...config,
            isEnabled: true,
          },
        });
      }
    }
  });

  const [
    patternCount,
    problemCount,
    problemPatternCount,
    achievementCount,
    runnerConfigCount,
  ] = await Promise.all([
    prisma.pattern.count(),
    prisma.problem.count(),
    prisma.problemPattern.count(),
    prisma.achievement.count(),
    prisma.problemRunnerConfig.count(),
  ]);

  console.log(
    `Seeded ${patternCount} patterns, ${problemCount} problems, ${problemPatternCount} problem-pattern relationships, ${achievementCount} achievements, and ${runnerConfigCount} runner configs.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
