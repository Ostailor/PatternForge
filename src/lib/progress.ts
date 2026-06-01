import type { Attempt, UserProgress } from "./types";

export function createEmptyProgress(): UserProgress {
  return {
    attempts: {},
    attemptLog: [],
    completedSessions: [],
    streak: 0,
  };
}

export function progressFromAttempts(attempts: Attempt[]): UserProgress {
  const attemptsByProblem = attempts.reduce<Record<string, Attempt>>(
    (byProblem, attempt) => ({
      ...byProblem,
      [attempt.problemId]: attempt,
    }),
    {},
  );
  const lastPracticedAt = attempts
    .map((attempt) => attempt.createdAt)
    .sort()
    .at(-1);

  return {
    attempts: attemptsByProblem,
    attemptLog: attempts,
    completedSessions: [],
    lastPracticedAt,
    streak: attempts.length > 0 ? 1 : 0,
  };
}

export function mergeAttempt(
  progress: UserProgress,
  attempt: Attempt,
): UserProgress {
  return progressFromAttempts([...getAttempts(progress), attempt]);
}

export function getAttempts(progress?: UserProgress): Attempt[] {
  if (!progress) {
    return [];
  }

  return progress.attemptLog ?? Object.values(progress.attempts);
}
