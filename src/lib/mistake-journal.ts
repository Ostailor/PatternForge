export const mistakeStatuses = ["active", "archived"] as const;
export const mistakeReviewStatuses = ["all", "due", "not_due"] as const;
export const mistakeSortOptions = [
  "newest",
  "oldest",
  "most_lapses",
  "due_soon",
] as const;

export type MistakeStatus = (typeof mistakeStatuses)[number];
export type MistakeReviewStatus = (typeof mistakeReviewStatuses)[number];
export type MistakeSortOption = (typeof mistakeSortOptions)[number];

export type MistakeJournalFilters = {
  patternId: string;
  status: MistakeStatus;
  reviewStatus: MistakeReviewStatus;
  search: string;
  sort: MistakeSortOption;
};

type SearchParamsLike = Record<string, string | string[] | undefined>;

function readParam(
  params: SearchParamsLike,
  key: string,
): string | undefined {
  const value = params[key];

  return Array.isArray(value) ? value[0] : value;
}

function isMistakeStatus(value: string): value is MistakeStatus {
  return mistakeStatuses.includes(value as MistakeStatus);
}

function isMistakeReviewStatus(value: string): value is MistakeReviewStatus {
  return mistakeReviewStatuses.includes(value as MistakeReviewStatus);
}

function isMistakeSortOption(value: string): value is MistakeSortOption {
  return mistakeSortOptions.includes(value as MistakeSortOption);
}

export function parseMistakeJournalFilters(
  params: SearchParamsLike,
): MistakeJournalFilters {
  const status = readParam(params, "status")?.trim() ?? "";
  const reviewStatus = readParam(params, "reviewStatus")?.trim() ?? "";
  const sort = readParam(params, "sort")?.trim() ?? "";
  const patternId = readParam(params, "patternId")?.trim() ?? "all";
  const search = readParam(params, "search")?.trim() ?? "";

  return {
    patternId: patternId || "all",
    status: isMistakeStatus(status) ? status : "active",
    reviewStatus: isMistakeReviewStatus(reviewStatus) ? reviewStatus : "all",
    search,
    sort: isMistakeSortOption(sort) ? sort : "newest",
  };
}
