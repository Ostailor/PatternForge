import Link from "next/link";

type LevelUpCardProps = {
  patternName: string;
  levelName?: string;
  levelNumber?: number;
  description?: string;
  nextActionLabel?: string;
  nextActionHref?: string;
  isLevelUp?: boolean;
};

export default function LevelUpCard({
  patternName,
  levelName,
  levelNumber,
  description,
  nextActionLabel,
  nextActionHref,
  isLevelUp = true,
}: LevelUpCardProps) {
  const levelText =
    levelName && typeof levelNumber === "number"
      ? `Level ${levelNumber} · ${levelName}`
      : levelName;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-indigo-700">
        {isLevelUp ? "Pattern level up" : "Pattern progress updated"}
      </p>
      <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
        {patternName}
        {levelName ? ` is now ${levelName}` : " moved forward"}
      </h3>
      {levelText ? (
        <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-indigo-700">
          {levelText}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          {description}
        </p>
      ) : null}
      {nextActionLabel && nextActionHref ? (
        <Link
          href={nextActionHref}
          className="mt-3 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-indigo-700"
        >
          {nextActionLabel}
        </Link>
      ) : null}
    </div>
  );
}
