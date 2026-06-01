import Link from "next/link";

type QuestCompletedCardProps = {
  title: string;
  xpAmount: number;
  description?: string;
  completed?: boolean;
  nextActionLabel?: string;
  nextActionHref?: string;
};

export default function QuestCompletedCard({
  title,
  xpAmount,
  description,
  completed = true,
  nextActionLabel,
  nextActionHref,
}: QuestCompletedCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        completed ? "border-teal-200 bg-teal-50" : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-black uppercase tracking-[0.16em] ${
              completed ? "text-teal-700" : "text-slate-500"
            }`}
          >
            {completed ? "Quest complete" : "Quest progress"}
          </p>
          <h3 className="mt-1 font-black text-slate-950">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
          ) : null}
        </div>
        <span
          className={`rounded-md border bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] ${
            completed
              ? "border-teal-200 text-teal-700"
              : "border-slate-200 text-slate-600"
          }`}
        >
          +{xpAmount} XP
        </span>
      </div>
      {nextActionLabel && nextActionHref ? (
        <Link
          href={nextActionHref}
          className="mt-3 inline-flex text-sm font-black text-teal-700 hover:text-teal-900"
        >
          {nextActionLabel}
        </Link>
      ) : null}
    </div>
  );
}
