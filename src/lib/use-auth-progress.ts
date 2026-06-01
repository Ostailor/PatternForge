"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { createEmptyProgress } from "@/lib/progress";
import type { GamificationStats } from "@/lib/gamification";
import type { ReviewStats } from "@/lib/review/queue";
import type { PatternProgress, UserProgress } from "@/lib/types";

type ProgressResponse = {
  progress: UserProgress | null;
  dashboardStats: GamificationStats | null;
  patternProgressById: Record<string, PatternProgress> | null;
  reviewStats: (ReviewStats & { memoryStreak: number }) | null;
};

export const ACCOUNT_PROGRESS_CHANGED_EVENT =
  "patternforge.account.progress.changed";
const AUTH_LOAD_TIMEOUT_MS = 5000;

export function notifyAccountProgressChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_PROGRESS_CHANGED_EVENT));
}

export function useAuthProgress() {
  const { isLoaded, isSignedIn } = useAuth();
  const [authLoadTimedOut, setAuthLoadTimedOut] = useState(false);
  const [progress, setProgress] = useState<UserProgress>(createEmptyProgress);
  const [dashboardStats, setDashboardStats] = useState<GamificationStats | null>(
    null,
  );
  const [reviewStats, setReviewStats] = useState<
    (ReviewStats & { memoryStreak: number }) | null
  >(null);
  const [patternProgressById, setPatternProgressById] = useState<Record<
    string,
    PatternProgress
  > | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProgress = useCallback(async () => {
    if (!isLoaded && !authLoadTimedOut) {
      return;
    }

    if (!isLoaded || !isSignedIn) {
      setProgress(createEmptyProgress());
      setDashboardStats(null);
      setReviewStats(null);
      setPatternProgressById(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/progress", {
        cache: "no-store",
      });

      if (!response.ok) {
        setProgress(createEmptyProgress());
        setDashboardStats(null);
        setReviewStats(null);
        setPatternProgressById(null);
        setIsLoading(false);
        return;
      }

      const payload = (await response.json()) as ProgressResponse;
      setProgress(payload.progress ?? createEmptyProgress());
      setDashboardStats(payload.dashboardStats);
      setReviewStats(payload.reviewStats);
      setPatternProgressById(payload.patternProgressById);
      setIsLoading(false);
    } catch {
      setProgress(createEmptyProgress());
      setDashboardStats(null);
      setReviewStats(null);
      setPatternProgressById(null);
      setIsLoading(false);
    }
  }, [authLoadTimedOut, isLoaded, isSignedIn]);

  useEffect(() => {
    if (isLoaded) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthLoadTimedOut(true);
    }, AUTH_LOAD_TIMEOUT_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isLoaded]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshProgress();
  }, [refreshProgress]);

  useEffect(() => {
    window.addEventListener(ACCOUNT_PROGRESS_CHANGED_EVENT, refreshProgress);

    return () => {
      window.removeEventListener(
        ACCOUNT_PROGRESS_CHANGED_EVENT,
        refreshProgress,
      );
    };
  }, [refreshProgress]);

  return {
    progress,
    dashboardStats,
    patternProgressById,
    reviewStats,
    isLoading: !authLoadTimedOut && (!isLoaded || isLoading),
    isSignedIn: Boolean(isSignedIn),
    refreshProgress,
  };
}
