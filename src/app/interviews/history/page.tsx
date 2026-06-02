import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import { patterns } from "@/data/patterns";
import type {
  InterviewResult,
  InterviewStatus,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type InterviewHistoryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InterviewHistoryFilters = {
  type: InterviewType | "all";
  result: InterviewResult | "all";
  targetPatternId: string;
  status: InterviewStatus | "all";
  from: string;
  to: string;
};

type InterviewHistoryData = Awaited<ReturnType<typeof getInterviewHistoryData>>;
type InterviewHistoryItem = InterviewHistoryData["interviews"][number];
type TrendPoint = InterviewHistoryData["stats"]["scoreTrend"][number];

const interviewTypes: InterviewType[] = [
  "SingleProblem",
  "FocusedPattern",
  "MixedInterview",
  "WeaknessRepair",
];

const interviewResults: InterviewResult[] = [
  "StrongHire",
  "Hire",
  "LeanHire",
  "LeanNoHire",
  "NoHire",
];

const interviewStatuses: InterviewStatus[] = ["Active", "Completed"];

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
): InterviewHistoryFilters {
  const type = getSingleSearchParam(searchParams, "type");
  const result = getSingleSearchParam(searchParams, "result");
  const targetPatternId = getSingleSearchParam(searchParams, "targetPatternId");
  const status = getSingleSearchParam(searchParams, "status");
  const from = getSingleSearchParam(searchParams, "from");
  const to = getSingleSearchParam(searchParams, "to");

  return {
    type: interviewTypes.includes(type as InterviewType)
      ? (type as InterviewType)
      : "all",
    result: interviewResults.includes(result as InterviewResult)
      ? (result as InterviewResult)
      : "all",
    targetPatternId:
      targetPatternId === "none" ||
      patterns.some((pattern) => pattern.id === targetPatternId)
        ? targetPatternId
        : "all",
    status: interviewStatuses.includes(status as InterviewStatus)
      ? (status as InterviewStatus)
      : "all",
    from: parseDateInput(from) ? from : "",
    to: parseDateInput(to) ? to : "",
  };
}

function formatInterviewType(interviewType: InterviewType): string {
  switch (interviewType) {
    case "SingleProblem":
      return "Single Problem";
    case "FocusedPattern":
      return "Focused Pattern";
    case "MixedInterview":
      return "Mixed Interview";
    case "WeaknessRepair":
      return "Weakness Repair";
  }
}

function formatResult(result: InterviewResult | null): string {
  switch (result) {
    case "StrongHire":
      return "Strong Hire";
    case "Hire":
      return "Hire";
    case "LeanHire":
      return "Lean Hire";
    case "LeanNoHire":
      return "Lean No Hire";
    case "NoHire":
      return "No Hire";
    default:
      return "Pending";
  }
}

function formatRubricCategory(category: RubricCategory | null): string {
  switch (category) {
    case "PatternRecognition":
      return "Pattern Recognition";
    case "ProblemSolving":
      return "Problem Solving";
    case "TimeManagement":
      return "Time Management";
    case "Communication":
    case "Implementation":
    case "Testing":
    case "Complexity":
      return category;
    default:
      return "No data";
  }
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(interview: InterviewHistoryItem): string {
  if (interview.completedAt) {
    const minutes = Math.max(
      1,
      Math.round(
        (interview.completedAt.getTime() - interview.startedAt.getTime()) /
          (1000 * 60),
      ),
    );

    return `${minutes} min`;
  }

  return `${interview.durationMinutes} min planned`;
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? `${score}%` : "Pending";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readMissedSignals(value: unknown): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const missedSignals = value.missedSignals;

  if (!Array.isArray(missedSignals)) {
    return [];
  }

  return missedSignals.filter(
    (missedSignal): missedSignal is string =>
      typeof missedSignal === "string" && missedSignal.trim().length > 0,
  );
}

function summarizeRubricScores(
  rubricScores: { category: RubricCategory; score: number }[],
) {
  const scoreByCategory = rubricScores.reduce(
    (summary, rubricScore) => {
      const current = summary.get(rubricScore.category) ?? {
        total: 0,
        count: 0,
      };

      current.total += rubricScore.score;
      current.count += 1;
      summary.set(rubricScore.category, current);

      return summary;
    },
    new Map<RubricCategory, { total: number; count: number }>(),
  );
  const averages = Array.from(scoreByCategory.entries()).map(
    ([category, { total, count }]) => ({
      category,
      average: Math.round(total / count),
    }),
  );

  return {
    bestCategory:
      averages.slice().sort((a, b) => b.average - a.average)[0]?.category ??
      null,
    weakestCategory:
      averages.slice().sort((a, b) => a.average - b.average)[0]?.category ??
      null,
  };
}

function getMostCommonMissedSignal(
  feedbackRecords: { rubric: unknown }[],
): string {
  const counts = new Map<string, number>();

  for (const feedback of feedbackRecords) {
    for (const missedSignal of readMissedSignals(feedback.rubric)) {
      const normalized = missedSignal.trim();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
  }

  return (
    Array.from(counts.entries()).sort(
      ([aSignal, aCount], [bSignal, bCount]) =>
        bCount - aCount || aSignal.localeCompare(bSignal),
    )[0]?.[0] ?? "No missed signals yet"
  );
}

async function getInterviewHistoryData(
  userProfileId: string,
  filters: InterviewHistoryFilters,
) {
  const prisma = getPrisma();
  const startedAtFilter = {
    ...(filters.from ? { gte: parseDateInput(filters.from) ?? undefined } : {}),
    ...(filters.to ? { lte: parseEndDateInput(filters.to) ?? undefined } : {}),
  };
  const where = {
    userProfileId,
    status:
      filters.status === "all"
        ? {
            in: interviewStatuses,
          }
        : filters.status,
    ...(filters.type === "all" ? {} : { interviewType: filters.type }),
    ...(filters.result === "all" ? {} : { result: filters.result }),
    ...(filters.targetPatternId === "all"
      ? {}
      : filters.targetPatternId === "none"
        ? { targetPatternId: null }
        : { targetPatternId: filters.targetPatternId }),
    ...(filters.from || filters.to ? { startedAt: startedAtFilter } : {}),
  };
  const [interviews, completedInterviews, rubricScores, feedbackRecords] =
    await Promise.all([
      prisma.interviewSession.findMany({
        where,
        include: {
          targetPattern: true,
          _count: {
            select: {
              rounds: true,
            },
          },
        },
        orderBy: [
          {
            status: "asc",
          },
          {
            startedAt: "desc",
          },
        ],
      }),
      prisma.interviewSession.findMany({
        where: {
          userProfileId,
          status: "Completed",
        },
        select: {
          id: true,
          title: true,
          overallScore: true,
          completedAt: true,
        },
        orderBy: {
          completedAt: "asc",
        },
      }),
      prisma.interviewRubricScore.findMany({
        where: {
          interviewSession: {
            userProfileId,
            status: "Completed",
          },
        },
        select: {
          category: true,
          score: true,
        },
      }),
      prisma.interviewFeedback.findMany({
        where: {
          interviewSession: {
            userProfileId,
            status: "Completed",
          },
        },
        select: {
          rubric: true,
        },
      }),
    ]);
  const scoredInterviews = completedInterviews.filter(
    (interview) => typeof interview.overallScore === "number",
  );
  const averageScore =
    scoredInterviews.length === 0
      ? null
      : Math.round(
          scoredInterviews.reduce(
            (total, interview) => total + (interview.overallScore ?? 0),
            0,
          ) / scoredInterviews.length,
        );
  const rubricSummary = summarizeRubricScores(rubricScores);

  return {
    interviews,
    stats: {
      completedCount: completedInterviews.length,
      averageScore,
      bestCategory: rubricSummary.bestCategory,
      weakestCategory: rubricSummary.weakestCategory,
      scoreTrend: scoredInterviews.slice(-8).map((interview) => ({
        id: interview.id,
        title: interview.title,
        date: interview.completedAt,
        score: interview.overallScore ?? 0,
      })),
      mostCommonMissedSignal: getMostCommonMissedSignal(feedbackRecords),
    },
  };
}

export default async function InterviewHistoryPage({
  searchParams,
}: InterviewHistoryPageProps) {
  const [userProfile, resolvedSearchParams] = await Promise.all([
    ensureCurrentUserProfile(),
    searchParams,
  ]);

  if (!userProfile) {
    return <UnauthenticatedHistoryPage />;
  }

  const filters = parseFilters(resolvedSearchParams ?? {});
  const historyData = await getInterviewHistoryData(userProfile.id, filters);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
              Interview History
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Interview history
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Review active sessions, completed mock interviews, scoring
              patterns, and follow-up signals from your own training history.
            </p>
          </div>
          <Link
            href="/interviews"
            className="rounded-lg border border-white/10 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-50"
          >
            Start Interview
          </Link>
        </div>
      </section>

      <HistoryStats stats={historyData.stats} />

      <HistoryFilters filters={filters} />

      {historyData.interviews.length === 0 ? (
        <EmptyHistoryState />
      ) : (
        <section className="mt-6 grid gap-4">
          {historyData.interviews.map((interview) => (
            <InterviewHistoryCard key={interview.id} interview={interview} />
          ))}
        </section>
      )}
    </main>
  );
}

function HistoryStats({ stats }: { stats: InterviewHistoryData["stats"] }) {
  return (
    <section className="mt-6 grid gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_1.4fr]">
      <StatCard
        label="Completed"
        value={stats.completedCount}
        detail="Finished interviews"
      />
      <StatCard
        label="Average score"
        value={formatScore(stats.averageScore)}
        detail="Completed sessions"
      />
      <StatCard
        label="Best category"
        value={formatRubricCategory(stats.bestCategory)}
        detail="Average rubric"
      />
      <StatCard
        label="Weakest category"
        value={formatRubricCategory(stats.weakestCategory)}
        detail="Average rubric"
      />
      <StatCard
        label="Missed signal"
        value={stats.mostCommonMissedSignal}
        detail="Most common feedback cue"
      />
      <ScoreTrend points={stats.scoreTrend} />
    </section>
  );
}

function HistoryFilters({ filters }: { filters: InterviewHistoryFilters }) {
  return (
    <form
      action="/interviews/history"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SelectField label="Interview type" name="type" value={filters.type}>
          <option value="all">All types</option>
          {interviewTypes.map((interviewType) => (
            <option key={interviewType} value={interviewType}>
              {formatInterviewType(interviewType)}
            </option>
          ))}
        </SelectField>

        <SelectField label="Result" name="result" value={filters.result}>
          <option value="all">All results</option>
          {interviewResults.map((result) => (
            <option key={result} value={result}>
              {formatResult(result)}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Target pattern"
          name="targetPatternId"
          value={filters.targetPatternId}
        >
          <option value="all">All patterns</option>
          <option value="none">No target pattern</option>
          {patterns.map((pattern) => (
            <option key={pattern.id} value={pattern.id}>
              {pattern.name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Status" name="status" value={filters.status}>
          <option value="all">Active and completed</option>
          <option value="Active">Active</option>
          <option value="Completed">Completed</option>
        </SelectField>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <DateField label="From" name="from" value={filters.from} />
          <DateField label="To" name="to" value={filters.to} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Apply filters
        </button>
        <Link
          href="/interviews/history"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function InterviewHistoryCard({
  interview,
}: {
  interview: InterviewHistoryItem;
}) {
  const isActive = interview.status === "Active";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                isActive
                  ? "border-teal-200 bg-teal-50 text-teal-700"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {interview.status}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
              {formatInterviewType(interview.interviewType)}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {interview.title}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {formatDate(interview.completedAt ?? interview.startedAt)} ·{" "}
            {formatDuration(interview)} ·{" "}
            {interview.targetPattern?.name ?? "No target pattern"}
          </p>
        </div>

        <Link
          href={
            isActive
              ? `/interviews/${interview.id}`
              : `/interviews/${interview.id}/summary`
          }
          className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
        >
          {isActive ? "Resume" : "View Summary"}
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Date" value={formatDate(interview.completedAt ?? interview.startedAt)} />
        <MiniStat label="Duration" value={formatDuration(interview)} />
        <MiniStat label="Result" value={formatResult(interview.result)} />
        <MiniStat label="Overall score" value={formatScore(interview.overallScore)} />
        <MiniStat label="Problems" value={interview._count.rounds} />
      </div>
    </article>
  );
}

function ScoreTrend({ points }: { points: TrendPoint[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Score trend
      </p>
      {points.length === 0 ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
          No scored interviews yet.
        </p>
      ) : (
        <div className="mt-4 flex h-28 items-end gap-2">
          {points.map((point) => (
            <div key={point.id} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-teal-600 to-cyan-400"
                style={{ height: `${Math.max(8, point.score)}%` }}
                title={`${point.title}: ${point.score}%`}
              />
              <span className="w-full truncate text-center text-[0.65rem] font-black text-slate-500">
                {formatDate(point.date).replace(/, \d{4}/, "")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 break-words text-2xl font-black leading-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-black leading-6 text-slate-800">{value}</p>
    </div>
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
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <select
        name={name}
        defaultValue={value}
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white"
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
    <label className="grid gap-2 text-sm font-bold text-slate-700">
      {label}
      <input
        type="date"
        name={name}
        defaultValue={value}
        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white"
      />
    </label>
  );
}

function EmptyHistoryState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        No interviews yet. Start a mock interview to test your readiness.
      </h2>
      <Link
        href="/interviews"
        className="mt-5 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
      >
        Start Interview
      </Link>
    </section>
  );
}

function UnauthenticatedHistoryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Interview History
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to view interview history
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Interview history, scores, and feedback are private to your account.
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
