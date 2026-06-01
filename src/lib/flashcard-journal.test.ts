import assert from "node:assert/strict";
import test from "node:test";

import { parseFlashcardJournalFilters } from "@/lib/flashcard-journal";

test("parseFlashcardJournalFilters defaults to active newest flashcards", () => {
  assert.deepEqual(parseFlashcardJournalFilters({}), {
    patternId: "all",
    status: "active",
    dueStatus: "all",
    search: "",
    sort: "newest",
  });
});

test("parseFlashcardJournalFilters accepts supported filters", () => {
  assert.deepEqual(
    parseFlashcardJournalFilters({
      patternId: "sliding-window",
      status: "archived",
      dueStatus: "due",
      search: "window",
      sort: "most_reviewed",
    }),
    {
      patternId: "sliding-window",
      status: "archived",
      dueStatus: "due",
      search: "window",
      sort: "most_reviewed",
    },
  );
});

test("parseFlashcardJournalFilters rejects unsupported filter values", () => {
  assert.deepEqual(
    parseFlashcardJournalFilters({
      status: "deleted",
      dueStatus: "soon",
      sort: "random",
      search: "  invariant  ",
    }),
    {
      patternId: "all",
      status: "active",
      dueStatus: "all",
      search: "invariant",
      sort: "newest",
    },
  );
});
