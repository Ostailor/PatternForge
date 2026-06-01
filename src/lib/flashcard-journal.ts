export const flashcardStatuses = ["active", "archived"] as const;
export const flashcardDueStatuses = ["all", "due", "not_due"] as const;
export const flashcardSortOptions = [
  "newest",
  "due_soon",
  "most_lapses",
  "most_reviewed",
] as const;

export type FlashcardStatus = (typeof flashcardStatuses)[number];
export type FlashcardDueStatus = (typeof flashcardDueStatuses)[number];
export type FlashcardSortOption = (typeof flashcardSortOptions)[number];

export type FlashcardJournalFilters = {
  patternId: string;
  status: FlashcardStatus;
  dueStatus: FlashcardDueStatus;
  search: string;
  sort: FlashcardSortOption;
};

type SearchParamsLike = Record<string, string | string[] | undefined>;

function readParam(
  params: SearchParamsLike,
  key: string,
): string | undefined {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function isFlashcardStatus(value: string): value is FlashcardStatus {
  return flashcardStatuses.includes(value as FlashcardStatus);
}

function isFlashcardDueStatus(value: string): value is FlashcardDueStatus {
  return flashcardDueStatuses.includes(value as FlashcardDueStatus);
}

function isFlashcardSortOption(value: string): value is FlashcardSortOption {
  return flashcardSortOptions.includes(value as FlashcardSortOption);
}

export function parseFlashcardJournalFilters(
  params: SearchParamsLike,
): FlashcardJournalFilters {
  const status = readParam(params, "status")?.trim() ?? "";
  const dueStatus = readParam(params, "dueStatus")?.trim() ?? "";
  const sort = readParam(params, "sort")?.trim() ?? "";
  const patternId = readParam(params, "patternId")?.trim() ?? "all";
  const search = readParam(params, "search")?.trim() ?? "";

  return {
    patternId: patternId || "all",
    status: isFlashcardStatus(status) ? status : "active",
    dueStatus: isFlashcardDueStatus(dueStatus) ? dueStatus : "all",
    search,
    sort: isFlashcardSortOption(sort) ? sort : "newest",
  };
}
