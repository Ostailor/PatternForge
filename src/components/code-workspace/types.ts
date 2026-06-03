import type {
  DebugInsightView,
  WorkspaceMode,
  WorkspaceTestCaseItem,
  WorkspaceSubmissionHistoryItem,
} from "@/app/problems/[problemId]/workspace/actions";
import type { CodeRunResult } from "@/lib/code-runner/types";
import type { Problem } from "@/lib/types";

export type WorkspaceProblem = Pick<
  Problem,
  "id" | "title" | "url" | "difficulty" | "estimatedMinutes"
>;

export type WorkspaceContext = {
  mode: WorkspaceMode;
  attemptId?: string;
  interviewRoundId?: string;
  battleRoundId?: string;
  returnHref: string;
  returnLabel: string;
};

export type EditableTestCase = {
  id: string;
  testCaseId?: string;
  name: string;
  inputText: string;
  expectedText: string;
  selected: boolean;
  source?: "User" | "PatternForge" | "Draft";
};

export type WorkspaceRunState = {
  result: CodeRunResult;
  codeRunId: string;
  codeSubmissionId: string;
} | null;

export type WorkspaceRunSummary = {
  codeRunId: string;
  codeSubmissionId: string;
  status: CodeRunResult["status"];
  runtimeMs?: number;
  testsPassed: number;
  testsFailed: number;
  stdout: string;
  stderr: string;
  errorMessage?: string;
};

export type {
  DebugInsightView,
  WorkspaceMode,
  WorkspaceTestCaseItem,
  WorkspaceSubmissionHistoryItem,
};
