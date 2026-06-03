"use client";

import type { CodeRunResult } from "@/lib/code-runner/types";

type RunResultsPanelProps = {
  result: CodeRunResult | null;
  structuredRunnerAvailable: boolean;
  isRunning: boolean;
  problemUrl: string;
  onDebug: () => void;
  onEditTests: () => void;
  onSaveAttempt: () => void;
  canDebug: boolean;
};

function statusTone(status: string) {
  if (status === "Succeeded") {
    return "border-teal-200 bg-teal-50 text-teal-800";
  }

  if (status === "Failed" || status === "RuntimeError" || status === "TimedOut") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  return "border-amber-200 bg-amber-50 text-amber-800";
}

function statusCopy({
  status,
  structuredRunnerAvailable,
  passedCount,
  failedCount,
}: {
  status: string;
  structuredRunnerAvailable: boolean;
  passedCount: number;
  failedCount: number;
}) {
  if (status === "Succeeded") {
    return structuredRunnerAvailable
      ? "All custom tests passed"
      : "Free-form run completed";
  }

  if (status === "Failed") {
    return failedCount > 0
      ? "Some custom tests failed"
      : "Custom test run failed";
  }

  if (status === "RuntimeError") {
    return "Runtime error";
  }

  if (status === "TimedOut") {
    return "Timeout";
  }

  if (status === "ValidationError") {
    return "Validation error";
  }

  return `${passedCount} self-tests passed`;
}

export default function RunResultsPanel({
  result,
  structuredRunnerAvailable,
  isRunning,
  problemUrl,
  onDebug,
  onEditTests,
  onSaveAttempt,
  canDebug,
}: RunResultsPanelProps) {
  const passedCount = result?.testResults.filter((test) => test.passed).length ?? 0;
  const failedCount = result
    ? result.testResults.length - passedCount
    : 0;
  const hasTests = (result?.testResults.length ?? 0) > 0;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Run Results
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Custom self-test report
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onDebug}
            disabled={!canDebug}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Debug with AI Coach
          </button>
          <button
            type="button"
            onClick={onEditTests}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Edit tests
          </button>
          <button
            type="button"
            onClick={onSaveAttempt}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Save attempt
          </button>
          <a
            href={problemUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Try on LeetCode
          </a>
        </div>
      </div>

      {isRunning ? (
        <RunStateCard
          title="Running"
          detail="PatternForge is running your Python code server-side and collecting stdout, stderr, errors, and test results."
          className="border-slate-200 bg-slate-50 text-slate-700"
        />
      ) : null}

      {!isRunning && !result ? (
        <RunStateCard
          title="Not run yet"
          detail="Run code to see status, runtime, stdout, stderr, errors, and per-test results."
          className="border-slate-200 bg-slate-50 text-slate-700"
        />
      ) : null}

      {!isRunning && result ? (
        <div className="mt-4 space-y-4">
          <div
            className={`rounded-lg border p-4 ${statusTone(result.status)}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-black">
                {statusCopy({
                  status: result.status,
                  structuredRunnerAvailable,
                  passedCount,
                  failedCount,
                })}
              </p>
              {typeof result.runtimeMs === "number" ? (
                <p className="text-xs font-black uppercase tracking-[0.12em] opacity-75">
                  {result.runtimeMs}ms
                </p>
              ) : null}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Metric label="Run status" value={result.status} />
              <Metric
                label="Tests passed"
                value={hasTests ? String(passedCount) : "0"}
              />
              <Metric
                label="Tests failed"
                value={hasTests ? String(failedCount) : "0"}
              />
            </div>
            {result.errorMessage ? (
              <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs font-semibold leading-5">
                {result.errorMessage}
              </pre>
            ) : null}
          </div>

          <OutputBlock label="stdout" value={result.stdout} />
          <OutputBlock label="stderr" value={result.stderr} />

          {result.testResults.length > 0 ? (
            <div className="space-y-3">
              {result.testResults.map((testResult) => (
                <div
                  key={`${testResult.name}-${String(testResult.passed)}`}
                  className={`rounded-lg border p-4 ${
                    testResult.passed
                      ? "border-teal-200 bg-teal-50"
                      : "border-rose-200 bg-rose-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-black text-slate-950">
                      {testResult.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {typeof testResult.runtimeMs === "number" ? (
                        <span className="rounded-md border border-current px-2 py-1 text-xs font-black uppercase tracking-[0.12em] opacity-80">
                          {testResult.runtimeMs}ms
                        </span>
                      ) : null}
                      <span className="rounded-md border border-current px-2 py-1 text-xs font-black uppercase tracking-[0.12em]">
                        {testResult.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <JsonBlock label="Input" value={testResult.inputJson} />
                    <JsonBlock label="Expected" value={testResult.expectedOutputJson} />
                    <JsonBlock label="Actual" value={testResult.actualOutputJson} />
                  </div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    <OptionalOutputBlock label="stdout" value={testResult.stdout} />
                    <OptionalOutputBlock label="stderr" value={testResult.stderr} />
                  </div>
                  {testResult.errorMessage ? (
                    <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-white/70 p-3 text-xs font-semibold leading-5 text-rose-800">
                      {testResult.errorMessage}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RunStateCard({
  title,
  detail,
  className,
}: {
  title: string;
  detail: string;
  className: string;
}) {
  return (
    <div className={`mt-4 rounded-lg border p-4 ${className}`}>
      <p className="text-sm font-black">{title}</p>
      <p className="mt-2 text-sm font-semibold leading-6 opacity-80">{detail}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-current/20 bg-white/60 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
        {label}
      </p>
      <p className="mt-1 text-lg font-black">{value}</p>
    </div>
  );
}

function OutputBlock({ label, value }: { label: string; value: string }) {
  if (!value) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-50">
        {value}
      </pre>
    </div>
  );
}

function OptionalOutputBlock({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
        {value?.trim() ? value : "(empty)"}
      </pre>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-700">
        {JSON.stringify(value ?? null, null, 2)}
      </pre>
    </div>
  );
}
