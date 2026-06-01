import Link from "next/link";

type XPToastProps = {
  title: string;
  xpAmount: number;
  description?: string;
  nextActionLabel?: string;
  nextActionHref?: string;
};

export default function XPToast({
  title,
  xpAmount,
  description,
  nextActionLabel,
  nextActionHref,
}: XPToastProps) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            XP earned
          </p>
          <h3 className="mt-1 text-lg font-black tracking-tight text-slate-950">
            {title}
          </h3>
          {description ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-teal-900">
              {description}
            </p>
          ) : null}
        </div>
        <span className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-sm font-black text-teal-700">
          +{xpAmount} XP
        </span>
      </div>
      {nextActionLabel && nextActionHref ? (
        <Link
          href={nextActionHref}
          className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700"
        >
          {nextActionLabel}
        </Link>
      ) : null}
    </div>
  );
}
