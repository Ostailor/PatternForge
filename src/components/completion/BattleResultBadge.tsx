type BattleResultBadgeProps = {
  result: string | null;
  xpEarned?: number;
};

function formatResult(result: string | null): string {
  switch (result) {
    case "Victory":
      return "Victory";
    case "PartialVictory":
      return "Partial Victory";
    case "Defeat":
      return "Defeat";
    default:
      return "Incomplete";
  }
}

function getResultStyles(result: string | null): string {
  switch (result) {
    case "Victory":
      return "border-teal-200 bg-teal-50 text-teal-700";
    case "PartialVictory":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "Defeat":
      return "border-amber-200 bg-amber-50 text-amber-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function BattleResultBadge({
  result,
  xpEarned,
}: BattleResultBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${getResultStyles(
        result,
      )}`}
    >
      {formatResult(result)}
      {typeof xpEarned === "number" ? `· +${xpEarned} XP` : ""}
    </span>
  );
}
