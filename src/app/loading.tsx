export default function Loading() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          PatternForge
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          Loading your training state
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Preparing saved progress, recommendations, and interview data.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
          <div className="h-28 animate-pulse rounded-lg border border-slate-200 bg-slate-100" />
        </div>
      </section>
    </main>
  );
}
