type ProgressBarProps = {
  value: number;
  label?: string;
  tone?: "teal" | "amber" | "rose" | "indigo";
};

const tones: Record<NonNullable<ProgressBarProps["tone"]>, string> = {
  teal: "from-teal-500 via-cyan-500 to-emerald-400",
  amber: "from-amber-400 via-orange-400 to-rose-400",
  rose: "from-rose-500 via-orange-400 to-amber-300",
  indigo: "from-indigo-500 via-sky-500 to-teal-400",
};

export default function ProgressBar({
  value,
  label,
  tone = "teal",
}: ProgressBarProps) {
  const normalized = Math.min(Math.max(value, 0), 100);

  return (
    <div className="space-y-2">
      {label ? (
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span>{label}</span>
          <span>{normalized}%</span>
        </div>
      ) : null}
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${tones[tone]}`}
          style={{ width: `${normalized}%` }}
        />
      </div>
    </div>
  );
}
