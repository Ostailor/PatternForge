import Link from "next/link";

type AchievementToastProps = {
  name: string;
  icon: string;
  xpAmount: number;
  description?: string;
  nextActionLabel?: string;
  nextActionHref?: string;
};

export default function AchievementToast({
  name,
  icon,
  xpAmount,
  description,
  nextActionLabel = "View Achievements",
  nextActionHref = "/achievements",
}: AchievementToastProps) {
  return (
    <div className="rounded-lg border border-teal-200 bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                Achievement earned
              </p>
              <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
                {name}
              </h3>
            </div>
            <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
              +{xpAmount} XP
            </span>
          </div>
          {description ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
          <Link
            href={nextActionHref}
            className="mt-3 inline-flex text-sm font-black text-teal-700 hover:text-teal-900"
          >
            {nextActionLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
