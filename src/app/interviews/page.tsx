import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import FeatureUnavailable from "@/components/FeatureUnavailable";
import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import type {
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import { getMasteryLevel, getMasteryLevelNumber } from "@/lib/mastery";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { getCurrentUserProgressSnapshot } from "@/lib/progress-db";
import type { PatternProgress } from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import {
  startFocusedInterviewAction,
  startMixedInterviewAction,
  startSingleProblemInterviewAction,
  startWeaknessRepairInterviewAction,
} from "./actions";

const STARTER_PATTERN_ID = "arrays-hashing";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

type InterviewsPageProps = {
  searchParams?: SearchParams;
};

type InterviewDashboardData = Awaited<ReturnType<typeof getInterviewDashboardData>>;
type ActiveInterview = NonNullable<InterviewDashboardData["activeInterview"]>;
type RecentInterview = InterviewDashboardData["recentCompletedInterviews"][number];
type PatternRow = ReturnType<typeof getPatternProgressRows>[number];

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const value = searchParams?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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
      return "No result";
  }
}

function formatRubricCategory(category: RubricCategory | null): string {
  switch (category) {
    case "Communication":
      return "Communication";
    case "PatternRecognition":
      return "Pattern Recognition";
    case "ProblemSolving":
      return "Problem Solving";
    case "Implementation":
      return "Implementation";
    case "Testing":
      return "Testing";
    case "Complexity":
      return "Complexity";
    case "TimeManagement":
      return "Time Management";
    default:
      return "No data";
  }
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? `${score}%` : "No score";
}

function getDefaultPatternProgress(patternId: string): PatternProgress {
  return {
    patternId,
    recognitionCorrect: 0,
    recognitionAttempts: 0,
    solvedCount: 0,
    attemptedCount: 0,
    masteryScore: 0,
    explanationScore: null,
    retentionScore: null,
    confidenceScore: null,
    lastPracticedAt: undefined,
  };
}

function getReadinessLabel(masteryScore: number): string {
  if (masteryScore >= 76) {
    return "Ready";
  }

  if (masteryScore >= 45) {
    return "Building";
  }

  return "Needs reps";
}

function getReadinessTone(masteryScore: number): "teal" | "amber" | "rose" {
  if (masteryScore >= 76) {
    return "teal";
  }

  if (masteryScore >= 45) {
    return "amber";
  }

  return "rose";
}

function getPatternProgressRows(
  patternProgressById: Record<string, PatternProgress> | null,
  problemCountByPatternId: Map<string, number>,
) {
  return patterns.map((pattern) => {
    const progress =
      patternProgressById?.[pattern.id] ?? getDefaultPatternProgress(pattern.id);

    return {
      pattern,
      progress,
      masteryLevel: getMasteryLevel(progress.masteryScore),
      levelNumber: getMasteryLevelNumber(progress.masteryScore),
      problemCount: problemCountByPatternId.get(pattern.id) ?? 0,
      readinessLabel: getReadinessLabel(progress.masteryScore),
      readinessTone: getReadinessTone(progress.masteryScore),
    };
  });
}

function getDefaultPatternId(patternRows: PatternRow[]): string {
  return (
    patternRows.find(
      (row) => row.pattern.id === STARTER_PATTERN_ID && row.problemCount > 0,
    )?.pattern.id ??
    patternRows.find((row) => row.problemCount > 0)?.pattern.id ??
    STARTER_PATTERN_ID
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

async function getPatternProblemCounts() {
  const rows = await getPrisma().problemPattern.findMany({
    where: {
      isPrimary: true,
    },
    select: {
      patternId: true,
    },
  });

  return rows.reduce((counts, row) => {
    counts.set(row.patternId, (counts.get(row.patternId) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

async function getInterviewDashboardData(userProfileId: string) {
  const prisma = getPrisma();
  const [
    activeInterview,
    recentCompletedInterviews,
    completedInterviews,
    rubricScores,
  ] = await Promise.all([
    prisma.interviewSession.findFirst({
      where: {
        userProfileId,
        status: "Active",
      },
      include: {
        targetPattern: true,
        rounds: {
          include: {
            problem: true,
          },
          orderBy: {
            roundNumber: "asc",
          },
        },
      },
      orderBy: {
        startedAt: "desc",
      },
    }),
    prisma.interviewSession.findMany({
      where: {
        userProfileId,
        status: "Completed",
      },
      include: {
        targetPattern: true,
        rounds: {
          include: {
            problem: true,
          },
          orderBy: {
            roundNumber: "asc",
          },
        },
      },
      orderBy: {
        completedAt: "desc",
      },
      take: 5,
    }),
    prisma.interviewSession.findMany({
      where: {
        userProfileId,
        status: "Completed",
      },
      select: {
        overallScore: true,
        result: true,
        completedAt: true,
      },
      orderBy: {
        completedAt: "desc",
      },
    }),
    prisma.interviewRubricScore.findMany({
      where: {
        interviewSession: {
          userProfileId,
        },
      },
      select: {
        category: true,
        score: true,
      },
    }),
  ]);
  const scoredInterviews = completedInterviews.filter(
    (interview) => typeof interview.overallScore === "number",
  );
  const averageOverallScore =
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
    activeInterview,
    recentCompletedInterviews,
    stats: {
      completedCount: completedInterviews.length,
      averageOverallScore,
      bestCategory: rubricSummary.bestCategory,
      weakestCategory: rubricSummary.weakestCategory,
      mostRecentResult: recentCompletedInterviews[0]?.result ?? null,
    },
  };
}

export default async function InterviewsPage({
  searchParams,
}: InterviewsPageProps) {
  if (!getFeatureFlag("interviews")) {
    return (
      <FeatureUnavailable
        eyebrow="Interview Mode"
        title="Interview Mode is unavailable"
        description="Mock interviews are turned off for this beta environment. You can still practice patterns, use reviews, and continue Daily Forge."
      />
    );
  }

  const [userProfile, resolvedSearchParams] = await Promise.all([
    ensureCurrentUserProfile(),
    searchParams,
  ]);
  const error = getSingleSearchParam(resolvedSearchParams, "error");

  if (!userProfile) {
    return <UnauthenticatedInterviewsPage error={error} />;
  }

  const [snapshot, problemCountByPatternId, dashboardData] = await Promise.all([
    getCurrentUserProgressSnapshot(),
    getPatternProblemCounts(),
    getInterviewDashboardData(userProfile.id),
  ]);
  const patternRows = getPatternProgressRows(
    snapshot.patternProgressById,
    problemCountByPatternId,
  );
  const defaultPatternId = getDefaultPatternId(patternRows);
  const hasActiveInterview = dashboardData.activeInterview !== null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Interview Mode
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
              Interview Mode
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Practice coding interviews with structure, timing, and feedback.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/interviews/history"
              className="rounded-lg border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-50"
            >
              View History
            </Link>
            <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                Session state
              </p>
              <p className="mt-1 text-2xl font-black">
                {hasActiveInterview ? "Active" : "Ready"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {error ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error === "signin"
            ? "Sign in before starting an interview."
            : error === "disabled"
              ? "Interview Mode is temporarily unavailable."
            : "Could not start that interview. Check the problem bank and try again."}
        </p>
      ) : null}

      <InterviewStats stats={dashboardData.stats} />

      {dashboardData.activeInterview ? (
        <ActiveInterviewCard interview={dashboardData.activeInterview} />
      ) : null}

      <section id="interview-options" className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Interview options
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Choose your mock session
            </h2>
          </div>
          {hasActiveInterview ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Finish active session first
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <InterviewOptionCard
            eyebrow="Single Problem Interview"
            title="Single Problem Interview"
            description="One timed coding problem."
            duration="30-45 min"
            action={startSingleProblemInterviewAction}
            buttonLabel="Start"
            disabled={hasActiveInterview}
          />

          <FocusedPatternCard
            patternRows={patternRows}
            defaultPatternId={defaultPatternId}
            disabled={hasActiveInterview}
          />

          <InterviewOptionCard
            eyebrow="Mixed Interview"
            title="Mixed Interview"
            description="Uses multiple patterns."
            duration="Two rounds"
            action={startMixedInterviewAction}
            buttonLabel="Start Mixed Interview"
            disabled={hasActiveInterview}
          />

          <InterviewOptionCard
            eyebrow="Weakness Repair Interview"
            title="Weakness Repair Interview"
            description="Based on recommendations and weak-pattern data."
            duration="Targeted repair"
            action={startWeaknessRepairInterviewAction}
            buttonLabel="Start Weakness Repair"
            disabled={hasActiveInterview}
          />
        </div>
      </section>

      <RecentInterviewsSection
        interviews={dashboardData.recentCompletedInterviews}
      />
    </main>
  );
}

function InterviewStats({
  stats,
}: {
  stats: InterviewDashboardData["stats"];
}) {
  return (
    <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Interviews completed" value={String(stats.completedCount)} />
      <StatCard
        label="Average overall score"
        value={formatScore(stats.averageOverallScore)}
      />
      <StatCard
        label="Best rubric category"
        value={formatRubricCategory(stats.bestCategory)}
      />
      <StatCard
        label="Weakest rubric category"
        value={formatRubricCategory(stats.weakestCategory)}
      />
      <StatCard
        label="Most recent result"
        value={formatResult(stats.mostRecentResult)}
      />
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function ActiveInterviewCard({ interview }: { interview: ActiveInterview }) {
  const completedRounds = interview.rounds.filter(
    (round) => round.status === "Completed" || round.status === "Skipped",
  ).length;
  const progress =
    interview.rounds.length === 0
      ? 0
      : Math.round((completedRounds / interview.rounds.length) * 100);

  return (
    <section className="mt-8 rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Active interview
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {interview.title}
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {formatInterviewType(interview.interviewType)} ·{" "}
            {interview.durationMinutes} minutes · Started{" "}
            {formatDate(interview.startedAt)}
          </p>
        </div>
        <span className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
          {interview.status}
        </span>
      </div>

      <div className="mt-5">
        <ProgressBar value={progress} label="Round progress" tone="teal" />
      </div>

      <Link
        href={`/interviews/${interview.id}`}
        className="mt-5 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
      >
        Continue Interview
      </Link>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {interview.rounds.map((round) => (
          <div
            key={round.id}
            className="rounded-lg border border-teal-100 bg-white p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Round {round.roundNumber} · {round.status}
            </p>
            <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">
              {round.problem.title}
            </h3>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {round.problem.difficulty} · {round.problem.estimatedMinutes} min
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function InterviewOptionCard({
  eyebrow,
  title,
  description,
  duration,
  action,
  buttonLabel,
  disabled,
}: {
  eyebrow: string;
  title: string;
  description: string;
  duration: string;
  action: () => Promise<void>;
  buttonLabel: string;
  disabled: boolean;
}) {
  return (
    <form
      action={action}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {eyebrow}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {title}
          </h3>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
          {duration}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      <button
        disabled={disabled}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        {buttonLabel}
      </button>
    </form>
  );
}

function FocusedPatternCard({
  patternRows,
  defaultPatternId,
  disabled,
}: {
  patternRows: PatternRow[];
  defaultPatternId: string;
  disabled: boolean;
}) {
  return (
    <form
      action={startFocusedInterviewAction}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Focused Pattern Interview
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Focused Pattern Interview
          </h3>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
          1-2 rounds
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        User selects a pattern.
      </p>

      <label className="mt-4 block">
        <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Target pattern
        </span>
        <select
          name="patternId"
          defaultValue={defaultPatternId}
          disabled={disabled}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 disabled:bg-slate-100 disabled:text-slate-500"
        >
          {patternRows.map((row) => (
            <option
              key={row.pattern.id}
              value={row.pattern.id}
              disabled={row.problemCount === 0}
            >
              {row.pattern.name} · {row.progress.masteryScore}% mastery ·{" "}
              {row.readinessLabel}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
        {patternRows.map((row) => (
          <PatternReadinessRow key={row.pattern.id} row={row} />
        ))}
      </div>

      <button
        disabled={disabled}
        className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
      >
        Start Focused Interview
      </button>
    </form>
  );
}

function PatternReadinessRow({ row }: { row: PatternRow }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-black text-slate-950">
            {row.pattern.name}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-500">
            {row.problemCount} seeded problem{row.problemCount === 1 ? "" : "s"}
          </p>
        </div>
        <MasteryBadge
          level={row.masteryLevel}
          levelNumber={row.levelNumber}
          score={row.progress.masteryScore}
        />
      </div>
      <div className="mt-3">
        <ProgressBar
          value={row.progress.masteryScore}
          label={row.readinessLabel}
          tone={row.readinessTone}
        />
      </div>
    </div>
  );
}

function RecentInterviewsSection({
  interviews,
}: {
  interviews: RecentInterview[];
}) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recent completed interviews
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Latest results
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
          {interviews.length} recent
        </span>
      </div>

      {interviews.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-600">
          No completed interviews yet. Start one above to create your first
          timed mock session.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {interviews.map((interview) => (
            <RecentInterviewCard key={interview.id} interview={interview} />
          ))}
        </div>
      )}
    </section>
  );
}

function RecentInterviewCard({ interview }: { interview: RecentInterview }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {formatInterviewType(interview.interviewType)}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {interview.title}
          </h3>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
          {formatScore(interview.overallScore)}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        {formatResult(interview.result)} · Completed{" "}
        {formatDate(interview.completedAt)} · {interview.durationMinutes} minutes
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {interview.rounds.map((round) => (
          <span
            key={round.id}
            className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600"
          >
            R{round.roundNumber}: {round.problem.title}
          </span>
        ))}
      </div>
    </article>
  );
}

function UnauthenticatedInterviewsPage({ error }: { error: string | null }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Interview Mode
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Interview Mode
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Practice coding interviews with structure, timing, and feedback.
        </p>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Sign in to save interview progress, generate sessions from your
          readiness data, and keep completed feedback in your profile.
        </p>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in to start
          </button>
        </SignInButton>
      </section>

      {error ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          Sign in before starting an interview.
        </p>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        <PreviewOptionCard
          title="Single Problem Interview"
          description="One timed coding problem."
          buttonLabel="Start"
        />
        <PreviewOptionCard
          title="Focused Pattern Interview"
          description="User selects a pattern with mastery and readiness context."
          buttonLabel="Start Focused Interview"
        />
        <PreviewOptionCard
          title="Mixed Interview"
          description="Uses multiple patterns."
          buttonLabel="Start Mixed Interview"
        />
        <PreviewOptionCard
          title="Weakness Repair Interview"
          description="Based on recommendations and weak-pattern data."
          buttonLabel="Start Weakness Repair"
        />
      </section>
    </main>
  );
}

function PreviewOptionCard({
  title,
  description,
  buttonLabel,
}: {
  title: string;
  description: string;
  buttonLabel: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Preview
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      <button
        disabled
        className="mt-5 rounded-lg bg-slate-300 px-4 py-3 text-sm font-black text-slate-500"
      >
        {buttonLabel}
      </button>
    </article>
  );
}
