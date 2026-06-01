"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

import {
  importLegacyAttemptsAction,
  type LegacyAttemptImportInput,
} from "@/app/practice-actions";
import { notifyAccountProgressChanged } from "@/lib/use-auth-progress";
import type { Confidence, SolvedStatus } from "@/lib/types";

const LEGACY_ATTEMPTS_KEY = "patternforge_attempts_v0";
const LEGACY_PROGRESS_KEY = "patternforge.progress.v0";
const MIGRATION_STATUS_KEY = "patternforge_attempts_v0_migration_status";

type BannerState = "hidden" | "prompt" | "importing" | "success" | "error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSolvedStatus(value: unknown): value is SolvedStatus {
  return (
    value === "Solved" ||
    value === "Partially Solved" ||
    value === "Not Solved"
  );
}

function isConfidence(value: number): value is Confidence {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function toLegacyAttempt(value: unknown): LegacyAttemptImportInput | null {
  if (!isRecord(value)) {
    return null;
  }

  const timeSpentMinutes = Number(value.timeSpentMinutes);
  const confidence = Number(value.confidence);

  if (
    typeof value.problemId !== "string" ||
    typeof value.selectedPatternId !== "string" ||
    !isSolvedStatus(value.solvedStatus) ||
    !Number.isInteger(timeSpentMinutes) ||
    timeSpentMinutes < 1 ||
    !isConfidence(confidence)
  ) {
    return null;
  }

  return {
    problemId: value.problemId,
    selectedPatternId: value.selectedPatternId,
    solvedStatus: value.solvedStatus,
    timeSpentMinutes,
    confidence,
    reflection:
      typeof value.reflection === "string" ? value.reflection : "",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : undefined,
  };
}

function readLegacyAttempts(): LegacyAttemptImportInput[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_ATTEMPTS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(toLegacyAttempt)
      .filter((attempt): attempt is LegacyAttemptImportInput =>
        Boolean(attempt),
      );
  } catch {
    return [];
  }
}

function setMigrationStatus(status: "imported" | "ignored" | "cleared") {
  window.localStorage.setItem(
    MIGRATION_STATUS_KEY,
    JSON.stringify({
      status,
      completedAt: new Date().toISOString(),
    }),
  );
}

export default function LocalProgressMigrationBanner() {
  const { isLoaded, isSignedIn } = useAuth();
  const [legacyAttempts, setLegacyAttempts] = useState<
    LegacyAttemptImportInput[]
  >([]);
  const [bannerState, setBannerState] = useState<BannerState>("hidden");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      setBannerState("hidden");
      setLegacyAttempts([]);
      return;
    }

    try {
      if (window.localStorage.getItem(MIGRATION_STATUS_KEY)) {
        setBannerState("hidden");
        return;
      }

      const attempts = readLegacyAttempts();

      if (attempts.length === 0) {
        setBannerState("hidden");
        return;
      }

      setLegacyAttempts(attempts);
      setMessage("");
      setBannerState("prompt");
    } catch {
      setBannerState("hidden");
    }
  }, [isLoaded, isSignedIn]);

  async function importProgress() {
    setBannerState("importing");
    setMessage("");

    const result = await importLegacyAttemptsAction(legacyAttempts);

    if (result.status === "unauthenticated") {
      setMessage("Sign in again to import local progress.");
      setBannerState("error");
      return;
    }

    if (result.status === "invalid") {
      setMessage(result.message);
      setBannerState("error");
      return;
    }

    setMigrationStatus("imported");
    notifyAccountProgressChanged();
    setMessage(
      `Import complete. ${result.importedCount} imported, ${result.skippedCount} skipped.`,
    );
    setBannerState("success");
  }

  function ignoreProgress() {
    setMigrationStatus("ignored");
    setBannerState("hidden");
  }

  function clearLocalProgress() {
    window.localStorage.removeItem(LEGACY_ATTEMPTS_KEY);
    window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    setMigrationStatus("cleared");
    setMessage("Local v0.0 progress cleared from this browser.");
    setBannerState("success");
  }

  if (bannerState === "hidden") {
    return null;
  }

  if (bannerState === "success") {
    return (
      <div className="border-b border-teal-200 bg-teal-50 px-4 py-3">
        <div className="mx-auto max-w-7xl text-sm font-bold text-teal-800">
          {message}
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-bold text-amber-900">
          {bannerState === "error"
            ? message
            : "We found local practice progress from v0.0. Import it into your account?"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={importProgress}
            disabled={bannerState === "importing"}
            className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {bannerState === "importing" ? "Importing..." : "Import Progress"}
          </button>
          <button
            type="button"
            onClick={ignoreProgress}
            disabled={bannerState === "importing"}
            className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-900 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ignore
          </button>
          <button
            type="button"
            onClick={clearLocalProgress}
            disabled={bannerState === "importing"}
            className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear Local Progress
          </button>
        </div>
      </div>
    </div>
  );
}
