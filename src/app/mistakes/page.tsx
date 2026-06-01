import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  archiveMistakeAction,
  reviewMistakeNowAction,
} from "@/app/mistakes/actions";
import { patterns } from "@/data/patterns";
import {
  mistakeReviewStatuses,
  mistakeSortOptions,
  mistakeStatuses,
  parseMistakeJournalFilters,
  type MistakeJournalFilters,
} from "@/lib/mistake-journal";
import {
  getMistakeJournalForUser,
  getMistakeJournalStats,
  type MistakeJournalItem,
} from "@/lib/mistake-journal-db";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type MistakesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isDue(dateValue: string): boolean {
  const date = new Date(dateValue);

  return !Number.isNaN(date.getTime()) && date.getTime() <= Date.now();
}

export default async function MistakesPage({ searchParams }: MistakesPageProps) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedMistakesPage />;
  }

  const filters = parseMistakeJournalFilters((await searchParams) ?? {});
  const [mistakes, stats] = await Promise.all([
    getMistakeJournalForUser(userProfile.id, filters),
    getMistakeJournalStats(userProfile.id),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
              Mistake Journal
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Mistakes forged into practice signals
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Track the patterns, corrections, and next reviews that help each
              mistake become a stronger recognition cue.
            </p>
          </div>
          <Link
            href="/review"
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Open Daily Review
          </Link>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <JournalStat label="Active signals" value={stats.activeCount} />
          <JournalStat label="Archived" value={stats.archivedCount} />
          <JournalStat label="Due now" value={stats.dueCount} />
        </div>
      </section>

      <MistakeFilters filters={filters} />

      {mistakes.length === 0 ? (
        <EmptyMistakeState />
      ) : (
        <section className="mt-6 grid gap-4">
          {mistakes.map((mistake) => (
            <MistakeCard key={mistake.id} mistake={mistake} />
          ))}
        </section>
      )}
    </main>
  );
}

function MistakeFilters({ filters }: { filters: MistakeJournalFilters }) {
  return (
    <form
      action="/mistakes"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-2 text-sm font-bold text-slate-700 xl:col-span-2">
          Search mistake text
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="Edge case, complexity, pointer..."
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-950 outline-none transition focus:border-teal-500 focus:bg-white"
          />
        </label>

        <SelectField label="Pattern" name="patternId" value={filters.patternId}>
          <option value="all">All patterns</option>
          {patterns.map((pattern) => (
            <option key={pattern.id} value={pattern.id}>
              {pattern.name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Status" name="status" value={filters.status}>
          {mistakeStatuses.map((status) => (
            <option key={status} value={status}>
              {status === "active" ? "Active" : "Archived"}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Review status"
          name="reviewStatus"
          value={filters.reviewStatus}
        >
          {mistakeReviewStatuses.map((status) => (
            <option key={status} value={status}>
              {status === "all"
                ? "All"
                : status === "due"
                  ? "Due"
                  : "Not due"}
            </option>
          ))}
        </SelectField>

        <SelectField label="Sort" name="sort" value={filters.sort}>
          {mistakeSortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {sort === "newest"
                ? "Newest"
                : sort === "oldest"
                  ? "Oldest"
                  : sort === "most_lapses"
                    ? "Most lapses"
                    : "Due soon"}
            </option>
          ))}
        </SelectField>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Apply filters
        </button>
        <Link
          href="/mistakes"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function MistakeCard({ mistake }: { mistake: MistakeJournalItem }) {
  const due = isDue(mistake.reviewDueAt);

  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
              Mistake Forged
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                due ? "bg-teal-100 text-teal-800" : "bg-white text-slate-600"
              }`}
            >
              {due ? "Due" : "Not due"}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
            {mistake.mistakeType}
          </h2>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
            {mistake.problemTitle}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-3">
          <MiniStat label="Reviewed" value={mistake.timesReviewed} />
          <MiniStat label="Lapses" value={mistake.lapses} />
          <MiniStat label="Status" value={mistake.status} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-amber-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">
            Practice Signal
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {mistake.description}
          </p>
        </div>
        <div className="rounded-lg border border-teal-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Correction
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {mistake.correction}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Detail label="Pattern" value={mistake.patternName} />
        <Detail label="Next Review" value={formatDate(mistake.reviewDueAt)} />
        <Detail label="Created" value={formatDate(mistake.createdAt)} />
      </div>

      {mistake.status === "active" ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form action={reviewMistakeNowAction}>
            <input type="hidden" name="mistakeId" value={mistake.id} />
            <button className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 sm:w-auto">
              Review now
            </button>
          </form>
          <form action={archiveMistakeAction}>
            <input type="hidden" name="mistakeId" value={mistake.id} />
            <button className="w-full rounded-lg border border-amber-300 bg-white px-4 py-3 text-sm font-black text-amber-800 transition hover:bg-amber-100 sm:w-auto">
              Archive mistake
            </button>
          </form>
        </div>
      ) : null}
    </article>
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

function JournalStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function EmptyMistakeState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Mistake Journal
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        No mistakes yet
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        No mistakes yet. Complete problems and use AI Coach to forge mistake
        cards.
      </p>
    </section>
  );
}

function UnauthenticatedMistakesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Mistake Journal
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Sign in to view mistake cards
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Your forged mistakes, corrections, and review schedule are saved to
          your PatternForge account.
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
