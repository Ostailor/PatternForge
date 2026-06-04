"use client";

import type { EditableTestCase } from "./types";

type TestCaseBuilderProps = {
  testCases: EditableTestCase[];
  onChange: (testCases: EditableTestCase[]) => void;
  onSave: () => void;
  onRunSelected: () => void;
  isSaving: boolean;
  isRunning: boolean;
  disabled: boolean;
  executionDisabled?: boolean;
  fallbackMessage: string;
};

function nextId() {
  return `case-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function TestCaseBuilder({
  testCases,
  onChange,
  onSave,
  onRunSelected,
  isSaving,
  isRunning,
  disabled,
  executionDisabled = false,
  fallbackMessage,
}: TestCaseBuilderProps) {
  function updateCase(
    id: string,
    patch: Partial<Omit<EditableTestCase, "id">>,
  ) {
    onChange(
      testCases.map((testCase) =>
        testCase.id === id ? { ...testCase, ...patch } : testCase,
      ),
    );
  }

  function addCase() {
    onChange([
      ...testCases,
      {
        id: nextId(),
        name: `Case ${testCases.length + 1}`,
        inputText: "[]",
        expectedText: "null",
        selected: true,
        source: "Draft",
      },
    ]);
  }

  function duplicateCase(testCase: EditableTestCase) {
    const currentIndex = testCases.findIndex((item) => item.id === testCase.id);
    const duplicate: EditableTestCase = {
      ...testCase,
      id: nextId(),
      testCaseId: undefined,
      name: `${testCase.name || "Custom test"} copy`,
      source: "Draft",
    };

    onChange([
      ...testCases.slice(0, currentIndex + 1),
      duplicate,
      ...testCases.slice(currentIndex + 1),
    ]);
  }

  if (disabled) {
    return (
      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold leading-6 text-amber-800">
          {fallbackMessage}
        </p>
      </section>
    );
  }

  return (
    <section
      id="custom-tests"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Custom tests
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            User/custom JSON tests
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            These are custom PatternForge self-tests based on your understanding
            of the problem. They are not official LeetCode tests.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addCase}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Add Test
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || testCases.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save Tests"}
          </button>
          <button
            type="button"
            onClick={onRunSelected}
            disabled={
              executionDisabled ||
              isRunning ||
              !testCases.some((testCase) => testCase.selected)
            }
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {executionDisabled
              ? "Execution Unavailable"
              : isRunning
                ? "Running..."
                : "Run Selected Tests"}
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {testCases.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
            No tests yet. Add a custom test based on your understanding of the
            problem.
          </p>
        ) : null}

        {testCases.map((testCase, index) => (
          <div
            key={testCase.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                <input
                  type="checkbox"
                  checked={testCase.selected}
                  onChange={(event) =>
                    updateCase(testCase.id, { selected: event.target.checked })
                  }
                  className="h-4 w-4 accent-teal-600"
                />
                Run
              </label>
              <label className="min-w-0 flex-1 text-sm font-bold text-slate-700">
                Test name
                <input
                  value={testCase.name}
                  onChange={(event) =>
                    updateCase(testCase.id, { name: event.target.value })
                  }
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-950 outline-none focus:border-teal-500"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => duplicateCase(testCase)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onChange(testCases.filter((item) => item.id !== testCase.id))
                  }
                  className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-black text-rose-700 transition hover:bg-rose-50"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                {testCase.source === "PatternForge"
                  ? "PatternForge-owned"
                  : testCase.source === "User"
                    ? "User custom"
                    : "Unsaved custom"}
              </span>
              {testCase.testCaseId ? (
                <span className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-teal-700">
                  Saved
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="block text-sm font-bold text-slate-700">
                Input JSON
                <textarea
                  value={testCase.inputText}
                  onChange={(event) =>
                    updateCase(testCase.id, { inputText: event.target.value })
                  }
                  rows={5}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 outline-none focus:border-teal-500"
                  placeholder={index === 0 ? "[[1, 2, 3], 3]" : "[]"}
                />
              </label>
              <label className="block text-sm font-bold text-slate-700">
                Expected Output JSON
                <textarea
                  value={testCase.expectedText}
                  onChange={(event) =>
                    updateCase(testCase.id, { expectedText: event.target.value })
                  }
                  rows={5}
                  className="mt-2 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-sm leading-6 text-slate-950 outline-none focus:border-teal-500"
                  placeholder={index === 0 ? "0" : "null"}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
