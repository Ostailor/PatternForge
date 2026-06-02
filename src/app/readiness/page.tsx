import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import type {
  InterviewMissedPattern,
  InterviewMissedSignal,
  InterviewRubricBreakdownItem,
  InterviewScoreTrendPoint,
  PatternConfusionMetric,
  ReadinessPatternSectionItem,
  ReadinessReport,
  ReadinessScoreBreakdown,
} from "@/lib/analytics/types";
import { getReadinessReport } from "@/lib/analytics/readinessMetrics";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const scoreLabels: Array<{
  key: keyof ReadinessScoreBreakdown;
  label: string;
  description: string;
}> = [
  {
    key: "patternCoverage",
    label: "Pattern coverage",
    description: "How many core patterns have real practice signals.",
  },
  {
    key: "patternRecognition",
    label: "Pattern recognition",
    description: "How often you identify the correct pattern.",
  },
  {
    key: "solveConsistency",
    label: "Solve consistency",
    description: "Solved attempts compared with total attempts.",
  },
  {
    key: "retention",
    label: "Retention",
    description: "Review ratings and memory stability.",
  },
  {
    key: "bossBattlePerformance",
    label: "Boss battle performance",
    description: "Completed battle victories across patterns.",
  },
  {
    key: "interviewPerformance",
    label: "Interview performance",
    description: "Timed mock interview scores with a light baseline before your first mock.",
  },
  {
    key: "mistakeRecovery",
    label: "Mistake recovery",
    description: "Review follow-through adjusted for lapses and confusions.",
  },
  {
    key: "confidence",
    label: "Confidence",
    description: "Average self-reported confidence on attempts.",
  },
];

function readinessMessage(report: ReadinessReport): string {
  switch (report.interviewReadinessLabel) {
    case "Interview-Ready":
      return "Your training signals are strong across practice, memory, and pressure tests. Keep reviewing misses and do not treat this as a guarantee.";
    case "Battle-Tested":
      return "You have meaningful readiness signals and some pressure-test data. The next gains likely come from retention and weak-pattern repair.";
    case "Pattern-Aware":
      return "You are recognizing patterns and building usable reps. More consistent solving, review, and battle practice will make the estimate stronger.";
    case "Building Foundation":
      return "You have started the foundation. Focus on core patterns, quick reviews, and clean reflections before chasing harder reps.";
    case "Just Starting":
      return "There is not enough practice data yet for a strong readiness estimate. Start with a few beginner-friendly reps and daily review.";
  }
}

function scoreTone(score: number): string {
  if (score >= 75) {
    return "text-emerald-700";
  }

  if (score >= 45) {
    return "text-amber-700";
  }

  return "text-rose-700";
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatNullableDate(dateValue: string | null): string {
  return dateValue ? formatDate(dateValue) : "Pending";
}

function formatScore(score: number | null): string {
  return typeof score === "number" ? `${score}%` : "No score";
}

function formatInterviewResult(result: ReadinessReport["interviewPerformance"]["bestResult"]): string {
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

function formatRubricCategory(category: InterviewRubricBreakdownItem["category"]): string {
  switch (category) {
    case "PatternRecognition":
      return "Pattern Recognition";
    case "ProblemSolving":
      return "Problem Solving";
    case "TimeManagement":
      return "Time Management";
    default:
      return category;
  }
}

function formatMockType(
  interviewType: ReadinessReport["interviewPerformance"]["recommendedNextMock"]["interviewType"],
): string {
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

export default async function ReadinessPage() {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedReadinessPage />;
  }

  const report = await getReadinessReport(userProfile.id);
  const isNewUser = report.totalAttempts === 0 && report.activePatternCount === 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1fr_0.42fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
              Readiness Report
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              Training readiness estimate
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              PatternForge estimates interview readiness from your attempts,
              pattern recognition, solve consistency, review retention, battle
              outcomes, timed mock interviews, mistake recovery, and confidence.
              It is a training signal, not a promise or guarantee of interview
              outcomes.
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-300">
              Overall score
            </p>
            <div className="mt-3 flex items-end gap-3">
              <span className="text-6xl font-black tracking-tight text-white">
                {report.overallReadinessScore}
              </span>
              <span className="pb-2 text-sm font-black text-slate-300">/100</span>
            </div>
            <p className="mt-3 text-xl font-black text-teal-300">
              {report.interviewReadinessLabel}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-300">
              {readinessMessage(report)}
            </p>
          </div>
        </div>
      </section>

      {isNewUser ? <NewUserReadinessState /> : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          label="Attempts"
          value={report.totalAttempts}
          detail="Saved practice attempts"
        />
        <MetricTile
          label="Coverage"
          value={`${report.activePatternCount}/${report.totalPatterns}`}
          detail="Patterns with activity"
        />
        <MetricTile
          label="Boss-ready"
          value={report.patternsReadyForBoss.length}
          detail="Patterns ready for pressure"
        />
        <MetricTile
          label="Needs review"
          value={report.patternsNeedingReview.length}
          detail="Patterns with retention risk"
        />
      </section>

      {report.interviewPerformance.completedCount === 0 ? (
        <FirstMockInterviewState />
      ) : null}

      <section className="mt-8 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <InterviewPerformanceSection report={report} />
        <RecommendedNextMockSection report={report} />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <InterviewRubricSection
          rubricBreakdown={report.interviewPerformance.rubricBreakdown}
        />
        <InterviewWeakSpotsSection report={report} />
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Score breakdown
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              What is driving the estimate
            </h2>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            Training signal
          </span>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {scoreLabels.map((scoreLabel) => (
            <ScoreRow
              key={scoreLabel.key}
              label={scoreLabel.label}
              description={scoreLabel.description}
              score={report.scoreBreakdown[scoreLabel.key]}
            />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <PatternListSection
          title="Strongest patterns"
          emptyText="Strong patterns will appear after you log a few attempts or reviews."
          patterns={report.strongestPatterns}
        />
        <PatternListSection
          title="Weakest patterns"
          emptyText="Weak patterns will appear once PatternForge has practice signals."
          patterns={report.weakestPatterns}
        />
        <ConfusionSection confusions={report.confusingPatternPairs} />
        <PatternListSection
          title="Patterns ready for boss battle"
          emptyText="No pattern is boss-ready yet. Aim for strong mastery, recognition, and retention first."
          patterns={report.patternsReadyForBoss}
          ctaLabel="Open Battles"
          ctaHref="/battles"
        />
        <PatternListSection
          title="Patterns needing review"
          emptyText="No retention risks are visible yet. Keep reviewing as cards become due."
          patterns={report.patternsNeedingReview}
          ctaLabel="Start Review"
          ctaHref="/review"
        />
        <NextSevenDaysSection report={report} />
      </section>
    </main>
  );
}

function MetricTile({
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
      <p className="mt-3 text-4xl font-black tracking-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-600">{detail}</p>
    </div>
  );
}

function InterviewPerformanceSection({ report }: { report: ReadinessReport }) {
  const performance = report.interviewPerformance;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Interview Performance
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Mock interview signal
          </h2>
        </div>
        <Link
          href="/interviews/history"
          className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
        >
          View History
        </Link>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric
          label="Completed"
          value={performance.completedCount}
          detail="Timed mock sessions"
        />
        <MiniMetric
          label="Average score"
          value={formatScore(performance.averageOverallScore)}
          detail="Overall interview score"
        />
        <MiniMetric
          label="Best result"
          value={formatInterviewResult(performance.bestResult)}
          detail="Highest hiring signal"
        />
        <MiniMetric
          label="Latest result"
          value={formatInterviewResult(performance.latestResult)}
          detail="Most recent mock"
        />
      </div>

      <ScoreTrend points={performance.scoreTrend} />
    </section>
  );
}

function InterviewRubricSection({
  rubricBreakdown,
}: {
  rubricBreakdown: InterviewRubricBreakdownItem[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Rubric Breakdown
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        Interview rubric averages
      </h2>
      <div className="mt-5 grid gap-3">
        {rubricBreakdown.map((rubric) => (
          <RubricRow key={rubric.category} rubric={rubric} />
        ))}
      </div>
    </section>
  );
}

function InterviewWeakSpotsSection({ report }: { report: ReadinessReport }) {
  const performance = report.interviewPerformance;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Interview Weak Spots
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        What mocks exposed
      </h2>
      <div className="mt-5 grid gap-4">
        <WeakCategoryList
          categories={performance.lowestScoringCategories}
        />
        <MissedSignalList signals={performance.commonMissedSignals} />
        <MissedPatternList patterns={performance.missedPatterns} />
      </div>
    </section>
  );
}

function RecommendedNextMockSection({ report }: { report: ReadinessReport }) {
  const recommendation = report.interviewPerformance.recommendedNextMock;

  return (
    <section className="rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Recommended Next Mock
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {recommendation.title}
      </h2>
      <span className="mt-4 inline-flex rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
        {formatMockType(recommendation.interviewType)}
      </span>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">
        {recommendation.reason}
      </p>
      <Link
        href={recommendation.href}
        className="mt-5 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
      >
        {report.interviewPerformance.completedCount === 0
          ? "Take your first mock interview."
          : "Start recommended mock"}
      </Link>
      <p className="mt-4 text-xs font-semibold leading-5 text-slate-600">
        This recommendation is a training prompt, not a prediction of interview
        success.
      </p>
    </section>
  );
}

function ScoreTrend({ points }: { points: InterviewScoreTrendPoint[] }) {
  return (
    <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Score trend
      </p>
      {points.length === 0 ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          No scored mock interviews yet.
        </p>
      ) : (
        <div className="mt-4 flex h-28 items-end gap-2">
          {points.map((point) => (
            <div
              key={point.id}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-teal-600 to-cyan-400"
                style={{ height: `${Math.max(8, point.score)}%` }}
                title={`${point.title}: ${point.score}%`}
              />
              <span className="w-full truncate text-center text-[0.65rem] font-black text-slate-500">
                {formatNullableDate(point.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RubricRow({ rubric }: { rubric: InterviewRubricBreakdownItem }) {
  const score = rubric.averageScore ?? 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">
            {formatRubricCategory(rubric.category)}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {rubric.count} scored interview{rubric.count === 1 ? "" : "s"}
          </p>
        </div>
        <span className={`text-2xl font-black ${scoreTone(score)}`}>
          {rubric.averageScore === null ? "No data" : `${rubric.averageScore}%`}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-teal-500"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function WeakCategoryList({
  categories,
}: {
  categories: ReadinessReport["interviewPerformance"]["lowestScoringCategories"];
}) {
  return (
    <WeakSpotGroup title="Lowest scoring rubric categories">
      {categories.length === 0 ? (
        <EmptyWeakSpot text="No interview rubric scores yet." />
      ) : (
        categories.map((category) => (
          <SignalPill
            key={category.category}
            label={formatRubricCategory(category.category)}
            detail={`${category.averageScore}% average`}
          />
        ))
      )}
    </WeakSpotGroup>
  );
}

function MissedSignalList({ signals }: { signals: InterviewMissedSignal[] }) {
  return (
    <WeakSpotGroup title="Common missed signals">
      {signals.length === 0 ? (
        <EmptyWeakSpot text="No repeated missed signals yet." />
      ) : (
        signals.map((signal) => (
          <SignalPill
            key={signal.signal}
            label={signal.signal}
            detail={`${signal.count} time${signal.count === 1 ? "" : "s"}`}
          />
        ))
      )}
    </WeakSpotGroup>
  );
}

function MissedPatternList({ patterns }: { patterns: InterviewMissedPattern[] }) {
  return (
    <WeakSpotGroup title="Patterns missed during interviews">
      {patterns.length === 0 ? (
        <EmptyWeakSpot text="No interview pattern misses recorded yet." />
      ) : (
        patterns.map((pattern) => (
          <Link
            key={pattern.patternId}
            href={`/patterns/${pattern.patternId}`}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            {pattern.patternName} · {pattern.count} miss
            {pattern.count === 1 ? "" : "es"}
          </Link>
        ))
      )}
    </WeakSpotGroup>
  );
}

function WeakSpotGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SignalPill({ label, detail }: { label: string; detail: string }) {
  return (
    <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600">
      {label} · {detail}
    </span>
  );
}

function EmptyWeakSpot({ text }: { text: string }) {
  return (
    <span className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">
      {text}
    </span>
  );
}

function MiniMetric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 break-words text-xl font-black text-slate-950">
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function ScoreRow({
  label,
  description,
  score,
}: {
  label: string;
  description: string;
  score: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-950">{label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {description}
          </p>
        </div>
        <span className={`text-2xl font-black ${scoreTone(score)}`}>
          {score}
        </span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-white">
        <div
          className="h-full rounded-full bg-teal-500"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function PatternListSection({
  title,
  emptyText,
  patterns,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  emptyText: string;
  patterns: ReadinessPatternSectionItem[];
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-black tracking-tight text-slate-950">
          {title}
        </h2>
        {ctaLabel && ctaHref ? (
          <Link
            href={ctaHref}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-600 transition hover:border-teal-200 hover:text-teal-700"
          >
            {ctaLabel}
          </Link>
        ) : null}
      </div>
      {patterns.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {patterns.map((pattern) => (
            <Link
              key={pattern.patternId}
              href={`/patterns/${pattern.patternId}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black text-slate-950">{pattern.patternName}</p>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                  Mastery {pattern.masteryScore}%
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {pattern.reason}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ConfusionSection({
  confusions,
}: {
  confusions: PatternConfusionMetric[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        Confusing pattern pairs
      </h2>
      {confusions.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          No repeated pattern confusions are visible yet. Recognition quiz data
          will fill this in over time.
        </p>
      ) : (
        <div className="mt-4 grid gap-3">
          {confusions.map((confusion) => (
            <Link
              key={`${confusion.selectedPatternId}:${confusion.correctPatternId}`}
              href={`/drills/contrast/${confusion.selectedPatternId}/${confusion.correctPatternId}`}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-black text-slate-950">
                  {confusion.selectedPatternName} vs {confusion.correctPatternName}
                </p>
                <span className="rounded-md bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                  {confusion.count} mix-up{confusion.count === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Last seen {formatDate(confusion.lastSeenAt)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function NextSevenDaysSection({ report }: { report: ReadinessReport }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        Recommended next 7 days
      </h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        This deterministic plan uses the current readiness signals. Generate a
        full learning plan when you want saved multi-day tracking.
      </p>
      <div className="mt-4 grid gap-3">
        {report.recommendedNextSevenDays.map((day) => (
          <Link
            key={day.dayIndex}
            href={day.href}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-200 hover:bg-teal-50"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-950 text-sm font-black text-white">
                {day.dayIndex + 1}
              </span>
              <div>
                <p className="font-black text-slate-950">{day.title}</p>
                <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">
                  {day.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewUserReadinessState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-teal-300 bg-teal-50 p-5">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        Start with a baseline week
      </h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
        This report is intentionally conservative until there are attempts,
        reviews, and pattern-recognition results. Start with Arrays & Hashing,
        Two Pointers, and Daily Review so the readiness estimate has real
        signals to work from.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/forge?pattern=arrays-hashing"
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Start beginner forge
        </Link>
        <Link
          href="/plans"
          className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-sm font-black text-teal-700 transition hover:bg-teal-100"
        >
          Generate a learning plan
        </Link>
      </div>
    </section>
  );
}

function FirstMockInterviewState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-teal-300 bg-teal-50 p-5">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        Add a mock interview baseline
      </h2>
      <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-700">
        The readiness score uses a light interview baseline until you complete a
        mock, so you are not heavily penalized for missing interview data. A
        timed session will make pacing, communication, and rubric signals more
        useful.
      </p>
      <Link
        href="/interviews"
        className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
      >
        Take your first mock interview.
      </Link>
    </section>
  );
}

function UnauthenticatedReadinessPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Readiness Report
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to view your training readiness
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          The report needs your saved attempts, reviews, battles, mistakes,
          confidence, and pattern history. It is a training estimate, not an
          interview guarantee.
        </p>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
