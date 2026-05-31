import Link from "next/link";

export default function PatternNotFound() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-700">
          Pattern not found
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          This pattern is not in the local map.
        </h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          PatternForge v0.0 only supports the manually seeded pattern catalog.
        </p>
        <Link
          href="/patterns"
          className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          View Pattern Map
        </Link>
      </div>
    </section>
  );
}
