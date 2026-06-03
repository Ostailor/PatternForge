"use server";

import {
  createCurrentUserAttempt,
  importCurrentUserAttempts,
} from "@/lib/progress-db";
import type { Attempt, Confidence, SolvedStatus } from "@/lib/types";

const MAX_LEGACY_IMPORT_ATTEMPTS = 500;

export type SaveAttemptInput = {
  problemId: string;
  selectedPatternId: string;
  solvedStatus: SolvedStatus;
  timeSpentMinutes: number;
  confidence: Confidence;
  reflection: string;
  codeSubmissionId?: string;
};

export type LegacyAttemptImportInput = SaveAttemptInput & {
  createdAt?: string;
};

export type SaveAttemptResult =
  | { status: "saved"; attempt: Attempt }
  | { status: "unauthenticated" }
  | { status: "invalid"; message: string };

export type ImportLegacyAttemptsResult =
  | { status: "imported"; importedCount: number; skippedCount: number }
  | { status: "unauthenticated" }
  | { status: "invalid"; message: string };

function validateAttemptInput(input: SaveAttemptInput): string | null {
  if (!input.problemId || !input.selectedPatternId) {
    return "Problem and pattern IDs are required.";
  }

  if (!Number.isInteger(input.timeSpentMinutes) || input.timeSpentMinutes < 1) {
    return "Time spent must be at least 1 minute.";
  }

  if (!Number.isInteger(input.confidence) || input.confidence < 1 || input.confidence > 5) {
    return "Confidence must be between 1 and 5.";
  }

  if (!input.reflection.trim()) {
    return "Reflection is required.";
  }

  return null;
}

function validateLegacyAttemptInput(input: LegacyAttemptImportInput): string | null {
  const reflection = input.reflection.trim() || "Imported from v0.0 local progress.";

  return validateAttemptInput({
    ...input,
    reflection,
  });
}

function isValidCreatedAt(createdAt?: string): boolean {
  if (!createdAt) {
    return true;
  }

  return !Number.isNaN(new Date(createdAt).getTime());
}

export async function saveAttemptAction(
  input: SaveAttemptInput,
): Promise<SaveAttemptResult> {
  const validationError = validateAttemptInput(input);

  if (validationError) {
    return { status: "invalid", message: validationError };
  }

  try {
    const attempt = await createCurrentUserAttempt({
      problemId: input.problemId,
      selectedPatternId: input.selectedPatternId,
      solvedStatus: input.solvedStatus,
      timeSpentMinutes: input.timeSpentMinutes,
      confidence: input.confidence,
      reflection: input.reflection.trim(),
      codeSubmissionId: input.codeSubmissionId,
    });

    if (!attempt) {
      return { status: "unauthenticated" };
    }

    return {
      status: "saved",
      attempt,
    };
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof Error ? error.message : "Attempt could not be saved.",
    };
  }
}

export async function importLegacyAttemptsAction(
  inputs: LegacyAttemptImportInput[],
): Promise<ImportLegacyAttemptsResult> {
  if (!Array.isArray(inputs)) {
    return { status: "invalid", message: "Imported attempts must be a list." };
  }

  const validInputs = inputs
    .slice(0, MAX_LEGACY_IMPORT_ATTEMPTS)
    .filter(
      (input) =>
        validateLegacyAttemptInput(input) === null &&
        isValidCreatedAt(input.createdAt),
    )
    .map((input) => ({
      ...input,
      reflection: input.reflection.trim() || "Imported from v0.0 local progress.",
    }));

  if (validInputs.length === 0) {
    return { status: "invalid", message: "No valid local attempts were found." };
  }

  const result = await importCurrentUserAttempts(validInputs);

  if (!result) {
    return { status: "unauthenticated" };
  }

  return {
    status: "imported",
    importedCount: result.importedCount,
    skippedCount:
      result.skippedCount +
      Math.min(inputs.length, MAX_LEGACY_IMPORT_ATTEMPTS) -
      validInputs.length,
  };
}
