import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import type { Difficulty } from "@/lib/types";

const VALID_DIFFICULTIES = new Set<Difficulty>(["Easy", "Medium", "Hard"]);
const LEETCODE_PROBLEM_URL = /^https:\/\/leetcode\.com\/problems\/[a-z0-9-]+\/$/;
const LONG_TEXT_LIMIT = 220;
const CLUE_TEXT_LIMIT = 140;
const MIN_PROBLEM_COUNT = 100;
const MIN_PROBLEMS_PER_PATTERN = 6;
const STATEMENT_LIKE_PATTERNS = [
  /\bexample\s*\d*\s*:/i,
  /\binput\s*:/i,
  /\boutput\s*:/i,
  /\bconstraints\s*:/i,
  /\bfollow[- ]?up\s*:/i,
  /\bnote\s*:/i,
  /\breturn\b.*\bgiven\b.*\barray\b/i,
  /\b1\s*<=\s*[a-z]/i,
  /\b10\^/i,
  /\bthe answer is\b/i,
];

const failures: string[] = [];

function fail(message: string) {
  failures.push(message);
}

function assertUnique(values: string[], label: string) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) {
      fail(`Duplicate ${label}: ${value}`);
    }

    seen.add(value);
  }
}

function checkText({
  owner,
  label,
  value,
  limit,
}: {
  owner: string;
  label: string;
  value: string;
  limit: number;
}) {
  if (!value.trim()) {
    fail(`${owner} has empty ${label}.`);
    return;
  }

  if (value.length > limit) {
    fail(`${owner} ${label} is too long (${value.length} > ${limit}).`);
  }

  for (const pattern of STATEMENT_LIKE_PATTERNS) {
    if (pattern.test(value)) {
      fail(`${owner} ${label} looks like copied problem text: "${value}"`);
    }
  }
}

function checkTextList({
  owner,
  label,
  values,
  minItems,
}: {
  owner: string;
  label: string;
  values: string[];
  minItems: number;
}) {
  if (values.length < minItems) {
    fail(`${owner} needs at least ${minItems} ${label}.`);
  }

  for (const value of values) {
    checkText({ owner, label, value, limit: CLUE_TEXT_LIMIT });
  }
}

function validatePatterns() {
  assertUnique(
    patterns.map((pattern) => pattern.id),
    "pattern id",
  );

  for (const pattern of patterns) {
    const owner = `Pattern ${pattern.id}`;

    checkText({ owner, label: "name", value: pattern.name, limit: 80 });
    checkText({ owner, label: "category", value: pattern.category, limit: 80 });
    checkText({
      owner,
      label: "description",
      value: pattern.description,
      limit: LONG_TEXT_LIMIT,
    });
    checkText({
      owner,
      label: "templateSummary",
      value: pattern.templateSummary,
      limit: LONG_TEXT_LIMIT,
    });
    checkTextList({
      owner,
      label: "recognition clues",
      values: pattern.recognitionClues,
      minItems: 3,
    });
    checkTextList({
      owner,
      label: "common mistakes",
      values: pattern.commonMistakes,
      minItems: 3,
    });

    if (!Number.isInteger(pattern.levelOrder) || pattern.levelOrder <= 0) {
      fail(`${owner} has invalid levelOrder.`);
    }
  }
}

function validateProblems() {
  const patternIds = new Set(patterns.map((pattern) => pattern.id));
  const problemIds = problems.map((problem) => problem.id);
  const problemUrls = problems.map((problem) => problem.url);
  const primaryCounts = new Map<string, number>();

  if (problems.length < MIN_PROBLEM_COUNT) {
    fail(`Problem bank has ${problems.length} problems; expected at least ${MIN_PROBLEM_COUNT}.`);
  }

  assertUnique(problemIds, "problem id");
  assertUnique(problemUrls, "problem URL");

  for (const problem of problems) {
    const owner = `Problem ${problem.id}`;

    checkText({ owner, label: "title", value: problem.title, limit: 100 });

    if (!LEETCODE_PROBLEM_URL.test(problem.url)) {
      fail(`${owner} has invalid LeetCode URL: ${problem.url}`);
    }

    if (!VALID_DIFFICULTIES.has(problem.difficulty)) {
      fail(`${owner} has invalid difficulty: ${problem.difficulty}`);
    }

    if (!patternIds.has(problem.primaryPatternId)) {
      fail(`${owner} has missing or invalid primary pattern: ${problem.primaryPatternId}`);
    }

    primaryCounts.set(
      problem.primaryPatternId,
      (primaryCounts.get(problem.primaryPatternId) ?? 0) + 1,
    );

    const secondaryIds = new Set(problem.secondaryPatternIds);

    if (secondaryIds.size !== problem.secondaryPatternIds.length) {
      fail(`${owner} has duplicate secondary patterns.`);
    }

    if (secondaryIds.has(problem.primaryPatternId)) {
      fail(`${owner} repeats primary pattern as secondary.`);
    }

    for (const patternId of problem.secondaryPatternIds) {
      if (!patternIds.has(patternId)) {
        fail(`${owner} has invalid secondary pattern: ${patternId}`);
      }
    }

    checkTextList({
      owner,
      label: "recognition clues",
      values: problem.recognitionClues,
      minItems: 3,
    });
    checkTextList({
      owner,
      label: "common mistakes",
      values: problem.commonMistakes,
      minItems: 2,
    });

    if (!Number.isInteger(problem.estimatedMinutes) || problem.estimatedMinutes < 10) {
      fail(`${owner} has invalid estimatedMinutes: ${problem.estimatedMinutes}`);
    }
  }

  for (const pattern of patterns) {
    const count = primaryCounts.get(pattern.id) ?? 0;

    if (count < MIN_PROBLEMS_PER_PATTERN) {
      fail(
        `Pattern ${pattern.id} has ${count} primary problems; expected at least ${MIN_PROBLEMS_PER_PATTERN}.`,
      );
    }
  }
}

validatePatterns();
validateProblems();

if (failures.length > 0) {
  console.error(`Seed data validation failed with ${failures.length} issue(s):`);

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}

const coverage = patterns
  .map((pattern) => {
    const count = problems.filter(
      (problem) => problem.primaryPatternId === pattern.id,
    ).length;

    return `${pattern.id}:${count}`;
  })
  .join(", ");

console.log(
  `Seed data validation passed: ${patterns.length} patterns, ${problems.length} problems. Coverage: ${coverage}`,
);
