import type { MasteryLevel } from "@/lib/types";

const styles: Record<MasteryLevel, string> = {
  "Not Started": "border-slate-200 bg-slate-50 text-slate-600",
  "Warming Up": "border-amber-200 bg-amber-50 text-amber-700",
  Apprentice: "border-orange-200 bg-orange-50 text-orange-700",
  Forging: "border-sky-200 bg-sky-50 text-sky-700",
  Sharp: "border-indigo-200 bg-indigo-50 text-indigo-700",
  Mastered: "border-teal-200 bg-teal-50 text-teal-700",
};

type MasteryBadgeProps = {
  level: MasteryLevel;
  levelNumber?: number;
  score?: number;
};

export default function MasteryBadge({
  level,
  levelNumber,
  score,
}: MasteryBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] ${styles[level]}`}
    >
      {typeof levelNumber === "number" ? `L${levelNumber} · ` : ""}
      {level}
      {typeof score === "number" ? ` · ${score}%` : ""}
    </span>
  );
}
