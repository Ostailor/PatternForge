import type { Attempt, UserProgress } from "./types";

const STORAGE_KEY = "patternforge.progress.v0";
const ATTEMPTS_STORAGE_KEY = "patternforge_attempts_v0";
const PROGRESS_EVENT = "patternforge.progress.changed";
const SERVER_PROGRESS: UserProgress = {
  attempts: {},
  attemptLog: [],
  completedSessions: [],
  streak: 0,
};

let cachedRawProgress: string | null | undefined;
let cachedProgress: UserProgress = SERVER_PROGRESS;

function safeGetItem(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function safeRemoveItem(key: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(key);
  } catch {
    // Treat unavailable storage as already empty.
  }
}

function notifyProgressChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(PROGRESS_EVENT));
}

export function createEmptyProgress(): UserProgress {
  return {
    attempts: {},
    attemptLog: [],
    completedSessions: [],
    streak: 0,
  };
}

function progressFromAttempts(attempts: Attempt[]): UserProgress {
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
  return progressFromAttempts([...(progress.attemptLog ?? getAttempts(progress)), attempt]);
}

export function loadProgress(): UserProgress {
  if (typeof window === "undefined") {
    return SERVER_PROGRESS;
  }

  const storedAttempts = getAttempts();
  if (storedAttempts.length > 0) {
    cachedRawProgress = safeGetItem(STORAGE_KEY);
    cachedProgress = progressFromAttempts(storedAttempts);
    return cachedProgress;
  }

  const raw = safeGetItem(STORAGE_KEY);

  if (raw === cachedRawProgress) {
    return cachedProgress;
  }

  if (!raw) {
    cachedRawProgress = raw;
    cachedProgress = SERVER_PROGRESS;
    return cachedProgress;
  }

  try {
    const parsed = JSON.parse(raw) as UserProgress;
    cachedRawProgress = raw;
    cachedProgress = {
      ...createEmptyProgress(),
      ...parsed,
      attempts: parsed.attempts ?? {},
      attemptLog: parsed.attemptLog ?? Object.values(parsed.attempts ?? {}),
      completedSessions: parsed.completedSessions ?? [],
    };
    return cachedProgress;
  } catch {
    cachedRawProgress = raw;
    cachedProgress = SERVER_PROGRESS;
    return cachedProgress;
  }
}

function readStoredAttempts(): Attempt[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = safeGetItem(ATTEMPTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Attempt[]) : [];
  } catch {
    return [];
  }
}

export function getAttempts(progress?: UserProgress): Attempt[] {
  if (progress) {
    return progress.attemptLog ?? Object.values(progress.attempts);
  }

  return readStoredAttempts();
}

export function saveProgress(progress: UserProgress): void {
  if (typeof window === "undefined") {
    return;
  }

  const raw = JSON.stringify(progress);
  cachedRawProgress = raw;
  cachedProgress = progress;
  safeSetItem(STORAGE_KEY, raw);
  safeSetItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(getAttempts(progress)));
  notifyProgressChanged();
}

export function saveAttempt(attempt: Attempt): Attempt[] {
  if (typeof window === "undefined") {
    return [];
  }

  const attempts = [...getAttempts(), attempt];
  const progress = progressFromAttempts(attempts);
  const rawProgress = JSON.stringify(progress);

  cachedRawProgress = rawProgress;
  cachedProgress = progress;
  safeSetItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts));
  safeSetItem(STORAGE_KEY, rawProgress);
  notifyProgressChanged();

  return attempts;
}

export function resetProgress(): UserProgress {
  const empty = createEmptyProgress();
  saveProgress(empty);
  return empty;
}

export function clearAttempts(): void {
  if (typeof window === "undefined") {
    return;
  }

  cachedRawProgress = null;
  cachedProgress = SERVER_PROGRESS;
  safeRemoveItem(ATTEMPTS_STORAGE_KEY);
  safeRemoveItem(STORAGE_KEY);
  notifyProgressChanged();
}

export function getProgressByPattern(patternId: string) {
  const attempts = getAttempts().filter(
    (attempt) => attempt.correctPatternId === patternId,
  );
  const recognitionCorrect = attempts.filter(
    (attempt) => attempt.wasPatternCorrect,
  ).length;
  const solvedCount = attempts.filter(
    (attempt) => attempt.solvedStatus === "Solved",
  ).length;
  const masteryScore =
    attempts.length === 0
      ? 0
      : Math.round(
          ((recognitionCorrect / attempts.length) * 0.6 +
            (solvedCount / attempts.length) * 0.4) *
            100,
        );
  const lastPracticedAt = attempts
    .map((attempt) => attempt.createdAt)
    .sort()
    .at(-1);

  return {
    patternId,
    recognitionCorrect,
    recognitionAttempts: attempts.length,
    solvedCount,
    attemptedCount: attempts.length,
    masteryScore,
    lastPracticedAt,
  };
}

export function subscribeToProgress(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.setTimeout(listener, 0);
  window.addEventListener(PROGRESS_EVENT, listener);
  window.addEventListener("storage", listener);

  return () => {
    window.removeEventListener(PROGRESS_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
