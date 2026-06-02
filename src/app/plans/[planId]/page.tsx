import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  completeLearningPlanStepAction,
  skipLearningPlanStepAction,
} from "@/app/plans/actions";
import { patterns } from "@/data/patterns";
import {
  getCurrentUserLearningPlan,
  type LearningPlanDetail,
} from "@/lib/learning-plans/service";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type LearningPlanDetailPageProps = {
  params: Promise<{ planId: string }>;
};

type LearningPlanStep = LearningPlanDetail["steps"][number];

const statusStyles: Record<string, string> = {
  Active: "border-teal-200 bg-teal-50 text-teal-700",
  Pending: "border-slate-200 bg-slate-50 text-slate-600",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Skipped: "border-amber-200 bg-amber-50 text-amber-700",
};

const stepTypeLabels: Record<string, string> = {
  Review: "Review",
  FocusProblem: "Focus Problem",
  MixedProblem: "Mixed Problem",
  ContrastDrill: "Contrast Drill",
  BossBattle: "Boss Battle",
  Reflection: "Reflection",
};

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "Open-ended";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Scheduled";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStepHref(step: LearningPlanStep): string | null {
  switch (step.stepType) {
    case "Review":
      return "/review";
    case "FocusProblem":
    case "MixedProblem":
      return step.problemId
        ? `/problems/${step.problemId}`
        : `/forge${step.targetPatternId ? `?pattern=${step.targetPatternId}` : ""}`;
    case "ContrastDrill":
      return getContrastDrillHref(step) ?? getPatternHref(step.targetPatternId);
    case "BossBattle":
      return step.targetPatternId
        ? `/battles?pattern=${step.targetPatternId}`
        : "/battles";
    case "Reflection":
      return "/patterns";
    default:
      return null;
  }
}

function getStepCtaLabel(step: LearningPlanStep): string {
  switch (step.stepType) {
    case "Review":
      return "Start Review";
    case "FocusProblem":
      return "Practice Problem";
    case "MixedProblem":
      return "Start Mixed Practice";
    case "ContrastDrill":
      return "Start Contrast Drill";
    case "BossBattle":
      return "Open Battles";
    case "Reflection":
      return "Review Patterns";
    default:
      return "Open Step";
  }
}

function getPatternHref(patternId: string | null): string | null {
  return patternId ? `/forge?pattern=${patternId}` : null;
}

function getContrastDrillHref(step: LearningPlanStep): string | null {
  const [selectedName, correctName] = step.title.split(" vs ");

  if (!selectedName || !correctName) {
    return null;
  }

  const selectedPattern = patterns.find((pattern) => pattern.name === selectedName);
  const correctPattern = patterns.find((pattern) => pattern.name === correctName);

  if (!selectedPattern || !correctPattern) {
    return null;
  }

  return `/drills/contrast/${selectedPattern.id}/${correctPattern.id}`;
}

export default async function LearningPlanDetailPage({
  params,
}: LearningPlanDetailPageProps) {
  const { planId } = await params;
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedPlansPage />;
  }

  const plan = await getCurrentUserLearningPlan(planId);

  if (!plan) {
    notFound();
  }

  const progress =
    plan.totalSteps === 0
      ? 0
      : Math.round((plan.completedSteps / plan.totalSteps) * 100);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/plans"
        className="text-sm font-black text-slate-600 transition hover:text-teal-700"
      >
        Back to plans
      </Link>

      <section className="mt-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              {plan.status}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
              {plan.title}
            </h1>
          </div>
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            {progress}% complete
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          {plan.goal}
        </p>
        <div className="mt-5 grid gap-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-3">
          <p>Start: {formatDate(plan.startDate)}</p>
          <p>End: {formatDate(plan.endDate)}</p>
          <p>
            Steps: {plan.completedSteps}/{plan.totalSteps}
          </p>
        </div>
        <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-teal-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Plan steps
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Daily sequence
            </h2>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          {plan.steps.map((step) => (
            <LearningPlanStepCard
              key={step.id}
              planId={plan.id}
              step={step}
            />
          ))}
        </div>
      </section>
    </main>
  );
}

function LearningPlanStepCard({
  planId,
  step,
}: {
  planId: string;
  step: LearningPlanStep;
}) {
  const statusClass =
    statusStyles[step.status] ?? "border-slate-200 bg-slate-50 text-slate-600";
  const stepHref = getStepHref(step);
  const isDone = step.status === "Completed" || step.status === "Skipped";

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-950 px-2.5 py-1 text-xs font-black text-white">
              Day {step.dayIndex + 1}
            </span>
            <span
              className={`rounded-md border px-2.5 py-1 text-xs font-black ${statusClass}`}
            >
              {step.status}
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
              {stepTypeLabels[step.stepType] ?? step.stepType}
            </span>
          </div>

          <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            {step.title}
          </h3>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            <span>Due {formatDate(step.dueDate)}</span>
            {step.targetPatternName ? (
              <span>Pattern: {step.targetPatternName}</span>
            ) : null}
            {step.problemTitle ? <span>Problem: {step.problemTitle}</span> : null}
            {step.targetCount ? <span>Target: {step.targetCount}</span> : null}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          {stepHref ? (
            <Link
              href={stepHref}
              className="inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
            >
              {getStepCtaLabel(step)}
            </Link>
          ) : null}
          {!isDone ? (
            <>
              <form action={completeLearningPlanStepAction}>
                <input type="hidden" name="planId" value={planId} />
                <input type="hidden" name="stepId" value={step.id} />
                <button className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100">
                  Complete
                </button>
              </form>
              <form action={skipLearningPlanStepAction}>
                <input type="hidden" name="planId" value={planId} />
                <input type="hidden" name="stepId" value={step.id} />
                <button className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50">
                  Skip
                </button>
              </form>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function UnauthenticatedPlansPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Learning Plans
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to view this plan
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Saved learning plans are tied to your PatternForge profile.
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
