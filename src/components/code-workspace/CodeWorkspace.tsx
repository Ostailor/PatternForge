"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  runWorkspaceCodeAction,
  saveCodeSubmissionAction,
  saveWorkspaceTestCasesAction,
} from "@/app/problems/[problemId]/workspace/actions";
import { STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE } from "@/lib/code-runner/messages";
import type {
  CodeRunnerTestCase,
  CodeRunResult,
} from "@/lib/code-runner/types";

import CodeEditor from "./CodeEditor";
import CodeSubmissionHistory from "./CodeSubmissionHistory";
import DebugCoachPanel from "./DebugCoachPanel";
import LanguageSelector from "./LanguageSelector";
import RunButton from "./RunButton";
import RunResultsPanel from "./RunResultsPanel";
import TestCaseBuilder from "./TestCaseBuilder";
import type {
  DebugInsightView,
  EditableTestCase,
  WorkspaceContext,
  WorkspaceProblem,
  WorkspaceRunSummary,
  WorkspaceRunState,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "./types";

type CodeWorkspaceProps = {
  problem: WorkspaceProblem;
  context: WorkspaceContext;
  runnerConfigured: boolean;
  codeRunnerEnabled?: boolean;
  codeRunnerUnavailableMessage?: string;
  aiCoachEnabled?: boolean;
  initialCode?: string;
  initialHistory: WorkspaceSubmissionHistoryItem[];
  initialTestCases: WorkspaceTestCaseItem[];
  initialDebugInsight: DebugInsightView | null;
  isAuthenticated: boolean;
  embedded?: boolean;
  onSubmissionChange?: (codeSubmissionId: string) => void;
  onRunChange?: (runSummary: WorkspaceRunSummary) => void;
  onDebugInsightChange?: (insight: DebugInsightView) => void;
  onSaveAttempt?: () => void;
};

const difficultyStyles: Record<WorkspaceProblem["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

const DEFAULT_CODE =
  "def solve():\n    # Write your PatternForge solution here.\n    return None\n";

const DEFAULT_FREE_RUN_CODE =
  "# Structured tests are not configured for this problem yet.\n# You can run free-form Python code here.\nprint('hello from PatternForge')\n";

function toEditableTestCase(testCase: WorkspaceTestCaseItem): EditableTestCase {
  return {
    id: testCase.id,
    testCaseId: testCase.id,
    name: testCase.name,
    inputText: JSON.stringify(testCase.inputJson, null, 2),
    expectedText: JSON.stringify(testCase.expectedOutputJson, null, 2),
    selected: true,
    source: testCase.source,
  };
}

function parseTests(testCases: EditableTestCase[], selectedOnly: boolean): {
  ok: true;
  tests: CodeRunnerTestCase[];
} | { ok: false; message: string } {
  const runnableTests = selectedOnly
    ? testCases.filter((testCase) => testCase.selected)
    : testCases;

  if (selectedOnly && runnableTests.length === 0) {
    return {
      ok: false,
      message: "Select at least one custom test to run.",
    };
  }

  try {
    return {
      ok: true,
      tests: runnableTests.map((testCase, index) => ({
        testCaseId: testCase.testCaseId,
        name: testCase.name.trim() || `Case ${index + 1}`,
        inputJson: JSON.parse(testCase.inputText),
        expectedOutputJson: JSON.parse(testCase.expectedText),
      })),
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Custom test JSON is invalid: ${error.message}`
          : "Custom test JSON is invalid.",
    };
  }
}

function summarizeRun({
  result,
  codeRunId,
  codeSubmissionId,
}: {
  result: CodeRunResult;
  codeRunId: string;
  codeSubmissionId: string;
}): WorkspaceRunSummary {
  return {
    codeRunId,
    codeSubmissionId,
    status: result.status,
    runtimeMs: result.runtimeMs,
    testsPassed: result.testResults.filter((testResult) => testResult.passed)
      .length,
    testsFailed: result.testResults.filter((testResult) => !testResult.passed)
      .length,
    stdout: result.stdout,
    stderr: result.stderr,
    errorMessage: result.errorMessage,
  };
}

export default function CodeWorkspace({
  problem,
  context,
  runnerConfigured,
  codeRunnerEnabled = true,
  codeRunnerUnavailableMessage = "Code execution is temporarily unavailable. You can still edit and save code.",
  aiCoachEnabled = true,
  initialCode,
  initialHistory,
  initialTestCases,
  initialDebugInsight,
  isAuthenticated,
  embedded = false,
  onSubmissionChange,
  onRunChange,
  onDebugInsightChange,
  onSaveAttempt,
}: CodeWorkspaceProps) {
  const [code, setCode] = useState(
    initialCode ?? (runnerConfigured ? DEFAULT_CODE : DEFAULT_FREE_RUN_CODE),
  );
  const [testCases, setTestCases] = useState<EditableTestCase[]>(
    initialTestCases.length > 0
      ? initialTestCases.map(toEditableTestCase)
      : [],
  );
  const [history, setHistory] = useState(initialHistory);
  const [currentSubmissionId, setCurrentSubmissionId] = useState<
    string | undefined
  >();
  const [runState, setRunState] = useState<WorkspaceRunState>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingTests, setIsSavingTests] = useState(false);
  const [message, setMessage] = useState("");

  const contextInput = useMemo(
    () => ({
      problemId: problem.id,
      attemptId: context.attemptId,
      interviewRoundId: context.interviewRoundId,
      battleRoundId: context.battleRoundId,
    }),
    [context.attemptId, context.battleRoundId, context.interviewRoundId, problem.id],
  );

  function mergeHistoryItem(item: WorkspaceSubmissionHistoryItem) {
    setHistory((items) => [
      item,
      ...items.filter((existingItem) => existingItem.id !== item.id),
    ].slice(0, 8));
  }

  function scrollToPanel(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  async function runCode(selectedOnly = true) {
    if (isRunning) {
      return;
    }

    setMessage("");

    if (!codeRunnerEnabled) {
      setMessage(codeRunnerUnavailableMessage);
      return;
    }

    const parsedTests: ReturnType<typeof parseTests> = runnerConfigured
      ? parseTests(testCases, selectedOnly)
      : { ok: true, tests: [] as CodeRunnerTestCase[] };

    if (!parsedTests.ok) {
      setMessage(parsedTests.message);
      return;
    }

    setIsRunning(true);
    const result = await runWorkspaceCodeAction({
      ...contextInput,
      codeSubmissionId: currentSubmissionId,
      language: "Python",
      code,
      tests: parsedTests.tests,
      runType: runnerConfigured ? "CustomTests" : "FreeRun",
    });
    setIsRunning(false);

    if (result.status !== "completed") {
      setMessage(result.message);
      return;
    }

    setRunState({
      result: result.result,
      codeRunId: result.codeRunId,
      codeSubmissionId: result.codeSubmissionId,
    });
    setCurrentSubmissionId(result.codeSubmissionId);
    onSubmissionChange?.(result.codeSubmissionId);
    onRunChange?.(
      summarizeRun({
        result: result.result,
        codeRunId: result.codeRunId,
        codeSubmissionId: result.codeSubmissionId,
      }),
    );
    mergeHistoryItem(result.historyItem);
  }

  async function saveTests() {
    if (isSavingTests) {
      return;
    }

    const parsedTests = parseTests(testCases, false);

    if (!parsedTests.ok) {
      setMessage(parsedTests.message);
      return;
    }

    setMessage("");
    setIsSavingTests(true);
    const result = await saveWorkspaceTestCasesAction({
      ...contextInput,
      tests: testCases.map((testCase, index) => ({
        id: testCase.source === "User" ? testCase.testCaseId : undefined,
        name: testCase.name.trim() || `Case ${index + 1}`,
        inputJson: parsedTests.tests[index]?.inputJson,
        expectedOutputJson: parsedTests.tests[index]?.expectedOutputJson,
      })),
    });
    setIsSavingTests(false);

    if (result.status !== "saved") {
      setMessage(result.message);
      return;
    }

    setMessage(result.message);
    setTestCases(result.tests.map(toEditableTestCase));
  }

  async function saveCode() {
    if (isSaving) {
      return;
    }

    setMessage("");
    setIsSaving(true);
    const result = await saveCodeSubmissionAction({
      ...contextInput,
      codeSubmissionId: currentSubmissionId,
      language: "Python",
      code,
    });
    setIsSaving(false);

    if (result.status !== "saved") {
      setMessage(result.message);
      return;
    }

    setMessage(result.message);
    setCurrentSubmissionId(result.historyItem.id);
    onSubmissionChange?.(result.historyItem.id);
    mergeHistoryItem(result.historyItem);
  }

  return (
    <section
      className={
        embedded ? "space-y-5" : "mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
        <aside className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Code Workspace
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
              {problem.title}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${difficultyStyles[problem.difficulty]}`}
              >
                {problem.difficulty}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                {context.mode}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              <a
                href={problem.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Open Problem on LeetCode
              </a>
              <Link
                href={context.returnHref}
                className="rounded-lg bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
              >
                {context.returnLabel}
              </Link>
            </div>
            {!runnerConfigured ? (
              <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
                {STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE}
              </p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <LanguageSelector />
            {!codeRunnerEnabled ? (
              <p className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
                {codeRunnerUnavailableMessage}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col gap-3">
              <RunButton
                isRunning={isRunning}
                structuredRunnerAvailable={runnerConfigured}
                executionAvailable={codeRunnerEnabled}
                onRun={() => runCode(true)}
              />
              <button
                type="button"
                onClick={saveCode}
                disabled={isSaving}
                className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Code"}
              </button>
            </div>
            {!isAuthenticated ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-bold leading-6 text-amber-800">
                Sign in to save code, run server-side tests, and store execution
                history.
              </p>
            ) : null}
            {message ? (
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">
                {message}
              </p>
            ) : null}
          </section>

          <CodeSubmissionHistory items={history} />
          <DebugCoachPanel
            codeRunId={runState?.codeRunId ?? null}
            runStatus={runState?.result.status ?? null}
            initialInsight={initialDebugInsight}
            enabled={aiCoachEnabled}
            onInsightCreated={onDebugInsightChange}
          />
        </aside>

        <div className="space-y-5">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <CodeEditor value={code} onChange={setCode} />
          </section>
          <TestCaseBuilder
            testCases={testCases}
            onChange={setTestCases}
            onSave={saveTests}
            onRunSelected={() => runCode(true)}
            isSaving={isSavingTests}
            isRunning={isRunning}
            disabled={!runnerConfigured}
            executionDisabled={!codeRunnerEnabled}
            fallbackMessage={STRUCTURED_RUNNER_NOT_CONFIGURED_MESSAGE}
          />
          <RunResultsPanel
            result={runState?.result ?? null}
            structuredRunnerAvailable={runnerConfigured}
            isRunning={isRunning}
            problemUrl={problem.url}
            onDebug={() => scrollToPanel("debug-coach")}
            onEditTests={() => scrollToPanel("custom-tests")}
            onSaveAttempt={() => {
              if (onSaveAttempt) {
                onSaveAttempt();
                return;
              }

              window.location.href = context.returnHref;
            }}
            canDebug={Boolean(
              runState?.result.status &&
                runState.result.status !== "Succeeded" &&
                runState.result.status !== "Queued" &&
                runState.result.status !== "Running",
            )}
          />
        </div>
      </div>
    </section>
  );
}
