import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Not found
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          This PatternForge page does not exist.
        </h1>
        <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
          Check the link, return to the dashboard, or continue from the main
          training routes.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
          >
            Back to Dashboard
          </Link>
          <Link
            href="/interviews"
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Interview Mode
          </Link>
        </div>
      </section>
    </main>
  );
}
