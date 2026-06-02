import "server-only";

import type { Difficulty } from "@/lib/types";
import { getPrisma } from "@/lib/prisma";
import type { RecommendationDifficultyPreference } from "./personalization";

export type PickedProblem = {
  problemId: string;
  title: string;
  patternId: string;
};

const difficultyPreferenceOrder: Record<
  RecommendationDifficultyPreference,
  Difficulty[]
> = {
  default: ["Easy", "Medium", "Hard"],
  easier: ["Easy", "Medium", "Hard"],
  harder: ["Medium", "Hard", "Easy"],
};

export async function pickPracticeProblemForPattern(
  userProfileId: string,
  patternId: string,
  options: { difficultyPreference?: RecommendationDifficultyPreference } = {},
): Promise<PickedProblem | null> {
  const scopedUserProfileId = userProfileId.trim();
  const scopedPatternId = patternId.trim();

  if (!scopedUserProfileId || !scopedPatternId) {
    return null;
  }

  const difficultyPreference =
    options.difficultyPreference && options.difficultyPreference !== "default"
      ? options.difficultyPreference
      : "default";
  const difficultyOrder = difficultyPreferenceOrder[difficultyPreference];
  const [attemptedProblemIds, problems] = await Promise.all([
    getPrisma().attempt.findMany({
      where: { userProfileId: scopedUserProfileId },
      select: { problemId: true },
    }),
    getPrisma().problem.findMany({
      where: {
        problemPatterns: {
          some: {
            patternId: scopedPatternId,
            isPrimary: true,
          },
        },
      },
      select: {
        id: true,
        title: true,
        estimatedMinutes: true,
        difficulty: true,
      },
      orderBy: [{ estimatedMinutes: "asc" }, { title: "asc" }],
    }),
  ]);
  const sortedProblems = problems
    .slice()
    .sort(
      (a, b) =>
        difficultyOrder.indexOf(a.difficulty) -
          difficultyOrder.indexOf(b.difficulty) ||
        a.estimatedMinutes - b.estimatedMinutes ||
        a.title.localeCompare(b.title),
    );
  const attempted = new Set(attemptedProblemIds.map((attempt) => attempt.problemId));
  const problem =
    sortedProblems.find((candidate) => !attempted.has(candidate.id)) ??
    sortedProblems[0];

  return problem
    ? {
        problemId: problem.id,
        title: problem.title,
        patternId: scopedPatternId,
      }
    : null;
}

export async function pickContrastProblem({
  userProfileId,
  correctPatternId,
  difficultyPreference,
}: {
  userProfileId: string;
  correctPatternId: string;
  difficultyPreference?: RecommendationDifficultyPreference;
}): Promise<PickedProblem | null> {
  return pickPracticeProblemForPattern(userProfileId, correctPatternId, {
    difficultyPreference,
  });
}
