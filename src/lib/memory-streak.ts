import type { Attempt } from "@/lib/types";

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}/;

export function toLocalDateKey(dateValue: Date | string): string | undefined {
  const date =
    typeof dateValue === "string" ? new Date(dateValue) : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return typeof dateValue === "string"
      ? dateValue.match(DATE_KEY_PATTERN)?.[0]
      : undefined;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() + days);

  return toLocalDateKey(date) ?? dateKey;
}

export function calculateConsecutiveDayStreak(dateKeys: string[]): number {
  const uniqueDateKeys = Array.from(new Set(dateKeys)).sort();

  if (uniqueDateKeys.length === 0) {
    return 0;
  }

  const dateSet = new Set(uniqueDateKeys);
  let streak = 1;
  let cursor = uniqueDateKeys.at(-1) as string;

  while (dateSet.has(addDays(cursor, -1))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

export function calculateMemoryStreak({
  attempts,
  reviewDates,
}: {
  attempts: Attempt[];
  reviewDates: Date[];
}): number {
  const activityDateKeys = [
    ...attempts
      .map((attempt) => toLocalDateKey(attempt.createdAt))
      .filter((dateKey): dateKey is string => Boolean(dateKey)),
    ...reviewDates
      .map((reviewedAt) => toLocalDateKey(reviewedAt))
      .filter((dateKey): dateKey is string => Boolean(dateKey)),
  ];

  return calculateConsecutiveDayStreak(activityDateKeys);
}
