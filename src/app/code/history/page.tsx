import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import type { Prisma } from "@/generated/prisma/client";
import type {
  CodeLanguage,
  CodeRunStatus,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type CodeHistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type ContextType = "all" | "Practice" | "Interview" | "Battle" | "Unlinked";

type CodeHistoryFilters = {
  problemId: string;
  language: CodeLanguage | "all";
  runStatus: CodeRunStatus | "all";
  contextType: ContextType;
  from: string;
  to: string;
};

type CodeHistoryData = Awaited<ReturnType<typeof getCodeHistoryData>>;
type CodeSubmissionItem = CodeHistoryData["submissions"][number];

const languages: CodeLanguage[] = ["Python"];
const runStatuses: CodeRunStatus[] = [
  "Queued",
  "Running",
  "Succeeded",
  "Failed",
  "TimedOut",
  "RuntimeError",
  "ValidationError",
];
const contextTypes: ContextType[] = [
  "all",
  "Practice",
  "Interview",
  "Battle",
  "Unlinked",
];

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const value = searchParams[key];

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseDateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function parseEndDateInput(value: string): Date | null {
  const date = parseDateInput(value);

  if (!date) {
    return null;
  }

  date.setUTCHours(23, 59, 59, 999);
  return date;
}

function parseFilters(
  searchParams: Record<string, string | string[] | undefined>,
): CodeHistoryFilters {
  const problemId = getSingleSearchParam(searchParams, "problemId");
  const language = getSingleSearchParam(searchParams, "language");
  const runStatus = getSingleSearchParam(searchParams, "runStatus");
  const contextType = getSingleSearchParam(searchParams, "contextType");
  const from = getSingleSearchParam(searchParams, "from");
  const to = getSingleSearchParam(searchParams, "to");

  return {
    problemId,
    language: languages.includes(language as CodeLanguage)
      ? (language as CodeLanguage)
      : "all",
    runStatus: runStatuses.includes(runStatus as CodeRunStatus)
      ? (runStatus as CodeRunStatus)
      : "all",
    contextType: contextTypes.includes(contextType as ContextType)
      ? (contextType as ContextType)
      : "all",
    from: parseDateInput(from) ? from : "",
    to: parseDateInput(to) ? to : "",
  };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatus(status: string | null): string {
  return status ?? "Not run";
}

function getStatusTone(status: string | null): string {
  if (status === "Succeeded") {
    return "border-teal-200 bg-teal-50 text-teal-700";
  }

  if (status === "RuntimeError" || status === "TimedOut" || status === "Failed") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (status) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function getContextType(submission: CodeSubmissionItem): Exclude<ContextType, "all"> {
  if (submission.battleRoundId) {
    return "Battle";
  }

  if (submission.interviewRoundId) {
    return "Interview";
  }

  if (submission.attemptId) {
    return "Practice";
  }

  return "Unlinked";
}

function getContextLabel(submission: CodeSubmissionItem): string {
  if (submission.battleRound) {
    return `Battle round ${submission.battleRound.roundNumber}: ${submission.battleRound.battle.title}`;
  }

  if (submission.interviewRound) {
    return `Interview round ${submission.interviewRound.roundNumber}: ${submission.interviewRound.interviewSession.title}`;
  }

  if (submission.attempt) {
    return `Practice attempt from ${formatDate(submission.attempt.createdAt)}`;
  }

  return "Unlinked practice draft";
}

function getWorkspaceHref(submission: CodeSubmissionItem): string {
  const params = new URLSearchParams();

  if (submission.battleRound) {
    params.set("mode", "Battle");
    params.set("battleId", submission.battleRound.battleId);
    params.set("battleRoundId", submission.battleRound.id);
  } else if (submission.interviewRound) {
    params.set("mode", "Interview");
    params.set("interviewId", submission.interviewRound.interviewSessionId);
    params.set("interviewRoundId", submission.interviewRound.id);
  } else {
    params.set("mode", "Practice");

    if (submission.attemptId) {
      params.set("attemptId", submission.attemptId);
    }
  }

  return `/problems/${submission.problemId}/workspace?${params.toString()}`;
}

function getContinueHref(submission: CodeSubmissionItem): string {
  if (submission.battleRound) {
    return `/battles/${submission.battleRound.battleId}`;
  }

  if (submission.interviewRound) {
    return `/interviews/${submission.interviewRound.interviewSessionId}`;
  }

  return `/problems/${submission.problemId}`;
}

function buildDateWhere(filters: CodeHistoryFilters): Prisma.DateTimeFilter | undefined {
  const gte = parseDateInput(filters.from);
  const lte = parseEndDateInput(filters.to);

  if (!gte && !lte) {
    return undefined;
  }

  return {
    ...(gte ? { gte } : {}),
    ...(lte ? { lte } : {}),
  };
}

function buildContextWhere(
  contextType: ContextType,
): Prisma.CodeSubmissionWhereInput {
  switch (contextType) {
    case "Practice":
      return {
        attemptId: {
          not: null,
        },
        interviewRoundId: null,
        battleRoundId: null,
      };
    case "Interview":
      return {
        interviewRoundId: {
          not: null,
        },
      };
    case "Battle":
      return {
        battleRoundId: {
          not: null,
        },
      };
    case "Unlinked":
      return {
        attemptId: null,
        interviewRoundId: null,
        battleRoundId: null,
      };
    case "all":
      return {};
  }
}

async function getProblemOptions(userProfileId: string) {
  const submissions = await getPrisma().codeSubmission.findMany({
    where: {
      userProfileId,
    },
    select: {
      problem: {
        select: {
          id: true,
          title: true,
        },
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });
  const byId = new Map<string, { id: string; title: string }>();

  for (const submission of submissions) {
    byId.set(submission.problem.id, submission.problem);
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

async function getCodeHistoryData(
  userProfileId: string,
  filters: CodeHistoryFilters,
) {
  const createdAt = buildDateWhere(filters);
  const where: Prisma.CodeSubmissionWhereInput = {
    userProfileId,
    ...(filters.problemId ? { problemId: filters.problemId } : {}),
    ...(filters.language !== "all" ? { language: filters.language } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...buildContextWhere(filters.contextType),
  };
  const [submissions, problemOptions] = await Promise.all([
    getPrisma().codeSubmission.findMany({
      where,
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            url: true,
          },
        },
        attempt: {
          select: {
            id: true,
            createdAt: true,
            solvedStatus: true,
          },
        },
        interviewRound: {
          select: {
            id: true,
            roundNumber: true,
            interviewSessionId: true,
            interviewSession: {
              select: {
                title: true,
              },
            },
          },
        },
        battleRound: {
          select: {
            id: true,
            roundNumber: true,
            battleId: true,
            battle: {
              select: {
                title: true,
              },
            },
          },
        },
        codeRuns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
          include: {
            testResults: {
              select: {
                passed: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 100,
    }),
    getProblemOptions(userProfileId),
  ]);

  return {
    submissions:
      filters.runStatus === "all"
        ? submissions
        : submissions.filter(
            (submission) => submission.codeRuns[0]?.status === filters.runStatus,
          ),
    problemOptions,
  };
}

export default async function CodeHistoryPage({
  searchParams,
}: CodeHistoryPageProps) {
  const [userProfile, resolvedSearchParams] = await Promise.all([
    ensureCurrentUserProfile(),
    searchParams ?? Promise.resolve({}),
  ]);

  if (!userProfile) {
    return <UnauthenticatedCodeHistoryPage />;
  }

  const filters = parseFilters(resolvedSearchParams);
  const { submissions, problemOptions } = await getCodeHistoryData(
    userProfile.id,
    filters,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Code History
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Your PatternForge code submissions
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          Review saved Python drafts, custom test runs, and the practice,
          interview, or battle context they belong to.
        </p>
      </section>

      <CodeHistoryFiltersForm
        filters={filters}
        problemOptions={problemOptions}
      />

      <section className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Submissions
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Saved workspace activity
            </h2>
          </div>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            {submissions.length} shown
          </span>
        </div>

        {submissions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-5 grid gap-4">
            {submissions.map((submission) => (
              <CodeSubmissionCard
                key={submission.id}
                submission={submission}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CodeHistoryFiltersForm({
  filters,
  problemOptions,
}: {
  filters: CodeHistoryFilters;
  problemOptions: { id: string; title: string }[];
}) {
  return (
    <form
      action="/code/history"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Filters
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <SelectField label="Problem" name="problemId" value={filters.problemId}>
          <option value="">All problems</option>
          {problemOptions.map((problem) => (
            <option key={problem.id} value={problem.id}>
              {problem.title}
            </option>
          ))}
        </SelectField>
        <SelectField label="Language" name="language" value={filters.language}>
          <option value="all">All languages</option>
          {languages.map((language) => (
            <option key={language} value={language}>
              {language}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Run status"
          name="runStatus"
          value={filters.runStatus}
        >
          <option value="all">All statuses</option>
          {runStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Context"
          name="contextType"
          value={filters.contextType}
        >
          {contextTypes.map((contextType) => (
            <option key={contextType} value={contextType}>
              {contextType === "all" ? "All contexts" : contextType}
            </option>
          ))}
        </SelectField>
        <DateField label="From" name="from" value={filters.from} />
        <DateField label="To" name="to" value={filters.to} />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
          Apply filters
        </button>
        <Link
          href="/code/history"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}

function SelectField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
      >
        {children}
      </select>
    </label>
  );
}

function DateField({
  label,
  name,
  value,
}: {
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
      />
    </label>
  );
}

function CodeSubmissionCard({
  submission,
}: {
  submission: CodeSubmissionItem;
}) {
  const latestRun = submission.codeRuns[0] ?? null;
  const testsPassed =
    latestRun?.testResults.filter((testResult) => testResult.passed).length ?? 0;
  const testsFailed = latestRun
    ? latestRun.testResults.length - testsPassed
    : 0;
  const workspaceHref = getWorkspaceHref(submission);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {getContextType(submission)}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {submission.problem.title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {getContextLabel(submission)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={submission.language} tone="slate" />
          <StatusPill
            label={formatStatus(latestRun?.status ?? null)}
            tone={latestRun?.status ?? null}
          />
        </div>
      </div>

      <div
        id={`run-${submission.id}`}
        className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
      >
        <Detail label="Created" value={formatDateTime(submission.createdAt)} />
        <Detail label="Updated" value={formatDateTime(submission.updatedAt)} />
        <Detail
          label="Latest run"
          value={latestRun ? formatDateTime(latestRun.createdAt) : "Not run"}
        />
        <Detail label="Tests passed" value={String(testsPassed)} />
        <Detail label="Tests failed" value={String(testsFailed)} />
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={workspaceHref}
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Open workspace
        </Link>
        {latestRun ? (
          <Link
            href={`#run-${submission.id}`}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
          >
            View latest run
          </Link>
        ) : (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-500">
            No run yet
          </span>
        )}
        <Link
          href={getContinueHref(submission)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Continue practice
        </Link>
        <a
          href={submission.problem.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Try on LeetCode
        </a>
      </div>
    </article>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: string | null;
}) {
  const className =
    tone === "slate" ? "border-slate-200 bg-slate-50 text-slate-600" : getStatusTone(tone);

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${className}`}
    >
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6">
      <p className="text-sm font-black text-slate-950">
        No code submissions yet. Open a problem workspace to start coding.
      </p>
      <Link
        href="/forge"
        className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
      >
        Find a problem
      </Link>
    </section>
  );
}

function UnauthenticatedCodeHistoryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Code History
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to view your code submissions
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Code submissions, runs, and custom test results are private to your
          PatternForge account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
