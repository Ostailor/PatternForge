"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";

import { createEmptyProgress } from "@/lib/progress";
import type { GamificationStats } from "@/lib/gamification";
import type { UserProgress } from "@/lib/types";

type ProgressResponse = {
  progress: UserProgress | null;
  dashboardStats: GamificationStats | null;
};

export const ACCOUNT_PROGRESS_CHANGED_EVENT =
  "patternforge.account.progress.changed";

export function notifyAccountProgressChanged() {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_PROGRESS_CHANGED_EVENT));
}

export function useAuthProgress() {
  const { isLoaded, isSignedIn } = useAuth();
  const [progress, setProgress] = useState<UserProgress>(createEmptyProgress);
  const [dashboardStats, setDashboardStats] = useState<GamificationStats | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);

  const refreshProgress = useCallback(async () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      setProgress(createEmptyProgress());
      setDashboardStats(null);
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
        setIsLoading(false);
        return;
      }

      const payload = (await response.json()) as ProgressResponse;
      setProgress(payload.progress ?? createEmptyProgress());
      setDashboardStats(payload.dashboardStats);
      setIsLoading(false);
    } catch {
      setProgress(createEmptyProgress());
      setDashboardStats(null);
      setIsLoading(false);
    }
  }, [isLoaded, isSignedIn]);

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
    isLoading: !isLoaded || isLoading,
    isSignedIn: Boolean(isSignedIn),
    refreshProgress,
  };
}
