import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { patterns } from "../src/data/patterns";
import { problems } from "../src/data/problems";
import { Difficulty, PrismaClient } from "../src/generated/prisma/client";
import type { Problem as SeedProblem } from "../src/lib/types";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

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
  });

  const [patternCount, problemCount, problemPatternCount] = await Promise.all([
    prisma.pattern.count(),
    prisma.problem.count(),
    prisma.problemPattern.count(),
  ]);

  console.log(
    `Seeded ${patternCount} patterns, ${problemCount} problems, and ${problemPatternCount} problem-pattern relationships.`,
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
