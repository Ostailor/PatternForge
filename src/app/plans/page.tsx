import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import { patterns } from "@/data/patterns";
import { getPlanTypeLabel } from "@/lib/learning-plans/generator";
import type { LearningPlanType } from "@/lib/learning-plans/types";
import { getCurrentUserLearningPlans } from "@/lib/learning-plans/service";

import { createLearningPlanAction } from "./actions";

const planTypes: Array<{
  planType: LearningPlanType;
  description: string;
}> = [
  {
    planType: "InterviewPrepSprint",
    description: "A 14-day general plan across review, focused reps, mixed practice, and pressure checks.",
  },
  {
    planType: "MasterPattern",
    description: "A focused plan for one selected pattern with repeated implementation reps.",
  },
  {
    planType: "WeaknessRepair",
    description: "Targets weak patterns, retention issues, and recurring pattern confusions.",
  },
  {
    planType: "MaintenanceMode",
    description: "Keeps memory fresh with reviews, mixed practice, and light reflection.",
  },
];

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

export default async function LearningPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const plans = await getCurrentUserLearningPlans();
  const { error } = await searchParams;

  if (!plans) {
    return <UnauthenticatedPlansPage />;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Learning Plans
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Build a deterministic plan from your progress
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          Pick a plan type. PatternForge uses your attempts, retention, mastery,
          and confusion history to create a structured set of daily steps.
        </p>
      </section>

      {error ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          Could not create that plan. Check the selected options and try again.
        </p>
      ) : null}

      <section className="mt-6 grid gap-5 lg:grid-cols-2">
        {planTypes.map((planType) => (
          <PlanTypeCard key={planType.planType} {...planType} />
        ))}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Your plans
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Active and completed plans
            </h2>
          </div>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            {plans.length} plan{plans.length === 1 ? "" : "s"}
          </span>
        </div>

        {plans.length === 0 ? (
          <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-bold text-slate-600">
            No plans yet. Generate one above to start a structured sequence.
          </p>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {plans.map((plan) => {
              const progress =
                plan.totalSteps === 0
                  ? 0
                  : Math.round((plan.completedSteps / plan.totalSteps) * 100);

              return (
                <article
                  key={plan.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                        {plan.status}
                      </p>
                      <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                        {plan.title}
                      </h3>
                    </div>
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
                      {progress}%
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
                    {plan.goal}
                  </p>
                  <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {formatDate(plan.startDate)} - {formatDate(plan.endDate)}
                  </p>
                  <Link
                    href={`/plans/${plan.id}`}
                    className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
                  >
                    Open Plan
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function PlanTypeCard({
  planType,
  description,
}: {
  planType: LearningPlanType;
  description: string;
}) {
  const isMasterPattern = planType === "MasterPattern";

  return (
    <form
      action={createLearningPlanAction}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <input type="hidden" name="planType" value={planType} />
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        {getPlanTypeLabel(planType)}
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {getPlanTypeLabel(planType)}
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      {isMasterPattern ? (
        <label className="mt-4 block">
          <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Target pattern
          </span>
          <select
            name="targetPatternId"
            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            defaultValue="arrays-hashing"
          >
            {patterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
        Generate Plan
      </button>
    </form>
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
          Sign in to generate a personalized plan
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Plans use your saved attempts, reviews, battles, mastery, and confusion
          history. Public templates are not saved.
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
