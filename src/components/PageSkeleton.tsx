type PageSkeletonProps = {
  eyebrow: string;
  title: string;
  rows?: number;
};

export default function PageSkeleton({
  eyebrow,
  title,
  rows = 4,
}: PageSkeletonProps) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          {title}
        </h1>
        <div className="mt-5 h-3 max-w-2xl animate-pulse rounded-full bg-white/15" />
        <div className="mt-3 h-3 max-w-xl animate-pulse rounded-full bg-white/10" />
      </section>
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className="min-h-36 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
            <div className="mt-4 h-5 w-2/3 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-4 space-y-2">
              <div className="h-3 animate-pulse rounded-full bg-slate-100" />
              <div className="h-3 w-5/6 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
