import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  archiveFlashcardAction,
  reviewFlashcardNowAction,
} from "@/app/flashcards/actions";
import { patterns } from "@/data/patterns";
import {
  flashcardDueStatuses,
  flashcardSortOptions,
  flashcardStatuses,
  parseFlashcardJournalFilters,
  type FlashcardJournalFilters,
} from "@/lib/flashcard-journal";
import {
  getFlashcardJournalForUser,
  getFlashcardJournalStats,
  type FlashcardJournalItem,
} from "@/lib/flashcard-journal-db";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type FlashcardsPageProps = {
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

export default async function FlashcardsPage({
  searchParams,
}: FlashcardsPageProps) {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedFlashcardsPage />;
  }

  const filters = parseFlashcardJournalFilters((await searchParams) ?? {});
  const [flashcards, stats] = await Promise.all([
    getFlashcardJournalForUser(userProfile.id, filters),
    getFlashcardJournalStats(userProfile.id),
  ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
              Flashcards
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
              Memory cards for pattern recall
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              Review the front, back, source problem, and schedule behind each
              AI Coach memory card.
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
          <JournalStat label="Active cards" value={stats.activeCount} />
          <JournalStat label="Archived" value={stats.archivedCount} />
          <JournalStat label="Due now" value={stats.dueCount} />
        </div>
      </section>

      <FlashcardFilters filters={filters} />

      {flashcards.length === 0 ? (
        <EmptyFlashcardState />
      ) : (
        <section className="mt-6 grid gap-4">
          {flashcards.map((flashcard) => (
            <FlashcardCard key={flashcard.id} flashcard={flashcard} />
          ))}
        </section>
      )}
    </main>
  );
}

function FlashcardFilters({ filters }: { filters: FlashcardJournalFilters }) {
  return (
    <form
      action="/flashcards"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <label className="grid gap-2 text-sm font-bold text-slate-700 xl:col-span-2">
          Search front or back
          <input
            type="search"
            name="search"
            defaultValue={filters.search}
            placeholder="Invariant, template, edge case..."
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
          {flashcardStatuses.map((status) => (
            <option key={status} value={status}>
              {status === "active" ? "Active" : "Archived"}
            </option>
          ))}
        </SelectField>

        <SelectField label="Due status" name="dueStatus" value={filters.dueStatus}>
          {flashcardDueStatuses.map((status) => (
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
          {flashcardSortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {sort === "newest"
                ? "Newest"
                : sort === "due_soon"
                  ? "Due soon"
                  : sort === "most_lapses"
                    ? "Most lapses"
                    : "Most reviewed"}
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
          href="/flashcards"
          className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Clear
        </Link>
      </div>
    </form>
  );
}

function FlashcardCard({ flashcard }: { flashcard: FlashcardJournalItem }) {
  const due = isDue(flashcard.reviewDueAt);

  return (
    <article className="rounded-lg border border-teal-200 bg-teal-50 p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md bg-teal-100 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-teal-800">
              Memory Card
            </span>
            <span
              className={`rounded-md px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                due ? "bg-amber-100 text-amber-800" : "bg-white text-slate-600"
              }`}
            >
              {due ? "Due" : "Not due"}
            </span>
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">
            {flashcard.patternName}
          </h2>
          <p className="mt-1 text-sm font-bold leading-6 text-slate-600">
            {flashcard.sourceProblemTitle ?? "No source problem"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-right sm:grid-cols-4">
          <MiniStat label="Reviewed" value={flashcard.timesReviewed} />
          <MiniStat label="Interval" value={`${flashcard.intervalDays}d`} />
          <MiniStat label="Reps" value={flashcard.repetitions} />
          <MiniStat label="Lapses" value={flashcard.lapses} />
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-teal-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Front
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {flashcard.front}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Back
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            {flashcard.back}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Detail label="Pattern" value={flashcard.patternName} />
        <Detail
          label="Source problem"
          value={flashcard.sourceProblemTitle ?? "No source problem"}
        />
        <Detail label="Review due" value={formatDate(flashcard.reviewDueAt)} />
        <Detail label="Status" value={flashcard.status} />
      </div>

      {flashcard.status === "active" ? (
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <form action={reviewFlashcardNowAction}>
            <input type="hidden" name="flashcardId" value={flashcard.id} />
            <button className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 sm:w-auto">
              Review now
            </button>
          </form>
          <form action={archiveFlashcardAction}>
            <input type="hidden" name="flashcardId" value={flashcard.id} />
            <button className="w-full rounded-lg border border-teal-300 bg-white px-4 py-3 text-sm font-black text-teal-800 transition hover:bg-teal-100 sm:w-auto">
              Archive
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
    <div className="rounded-lg border border-teal-200 bg-white px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-teal-200 bg-white px-3 py-2">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function EmptyFlashcardState() {
  return (
    <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Flashcards
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        No flashcards yet
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        No flashcards yet. Use AI Coach after an attempt to create memory
        cards.
      </p>
    </section>
  );
}

function UnauthenticatedFlashcardsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Flashcards
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Sign in to view memory cards
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Your AI Coach flashcards and review schedule are saved to your
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
