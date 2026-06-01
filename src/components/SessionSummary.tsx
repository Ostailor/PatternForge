import type { Attempt, ForgeSessionSummary, Pattern, Problem } from "@/lib/types";

type SessionSummaryProps = {
  summary?: Pick<
    ForgeSessionSummary,
    "attempted" | "solved" | "averageConfidence"
  >;
  attempt?: Attempt;
  problem?: Problem;
  correctPattern?: Pattern;
};

export default function SessionSummary({
  summary,
  attempt,
  problem,
  correctPattern,
}: SessionSummaryProps) {
  if (attempt && problem) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Session Summary
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Attempt forged
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              {problem.title}
            </p>
          </div>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Saved
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Recognition
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.wasPatternCorrect ? "Correct" : "Review"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Solved
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.solvedStatus}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Confidence
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.confidence}/5
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Next Training Move
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-teal-800">
            Review the correct pattern, then use Coach Review if you want
            feedback on your implementation. Correct pattern:{" "}
            {correctPattern?.name ?? "Unknown"}.
          </p>
        </div>
      </section>
    );
  }

  if (!summary) {
    return null;
  }

  const stats = [
    { label: "Attempts", value: summary.attempted },
    { label: "Solved", value: summary.solved },
    { label: "Confidence", value: summary.averageConfidence.toFixed(1) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {stat.label}
          </p>
          <p
            className="mt-2 text-2xl font-black text-slate-950"
            suppressHydrationWarning
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
