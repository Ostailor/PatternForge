import assert from "node:assert/strict";
import test from "node:test";

import { parseMistakeJournalFilters } from "@/lib/mistake-journal";

test("parseMistakeJournalFilters defaults to active newest journal", () => {
  assert.deepEqual(parseMistakeJournalFilters({}), {
    patternId: "all",
    status: "active",
    reviewStatus: "all",
    search: "",
    sort: "newest",
  });
});

test("parseMistakeJournalFilters accepts supported filters", () => {
  assert.deepEqual(
    parseMistakeJournalFilters({
      patternId: "two-pointers",
      status: "archived",
      reviewStatus: "due",
      search: "pointer",
      sort: "most_lapses",
    }),
    {
      patternId: "two-pointers",
      status: "archived",
      reviewStatus: "due",
      search: "pointer",
      sort: "most_lapses",
    },
  );
});

test("parseMistakeJournalFilters rejects unsupported filter values", () => {
  assert.deepEqual(
    parseMistakeJournalFilters({
      status: "deleted",
      reviewStatus: "soon",
      sort: "random",
      search: "  edge case  ",
    }),
    {
      patternId: "all",
      status: "active",
      reviewStatus: "all",
      search: "edge case",
      sort: "newest",
    },
  );
});
