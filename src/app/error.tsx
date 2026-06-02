"use client";

import Link from "next/link";
import { useEffect } from "react";

type ErrorPageProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
};

export default function ErrorPage({ error, unstable_retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
          Something went wrong
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          PatternForge could not load this view.
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
          Your saved progress is not changed. Retry the view, or return to the
          dashboard and continue from there.
        </p>
        {error.digest ? (
          <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs font-bold text-slate-500">
            Error reference: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
