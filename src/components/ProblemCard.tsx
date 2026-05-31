import Link from "next/link";

import { getPatternById } from "@/data/patterns";
import type { Problem } from "@/lib/types";

const difficultyStyles: Record<Problem["difficulty"], string> = {
  Easy: "bg-teal-50 text-teal-700 border-teal-200",
  Medium: "bg-amber-50 text-amber-700 border-amber-200",
  Hard: "bg-rose-50 text-rose-700 border-rose-200",
};

type ProblemCardProps = {
  problem: Problem;
  showPrimaryPattern?: boolean;
};

export default function ProblemCard({
  problem,
  showPrimaryPattern = true,
}: ProblemCardProps) {
  const pattern = getPatternById(problem.primaryPatternId);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/problems/${problem.id}`}
            className="text-base font-black tracking-tight text-slate-950 hover:text-teal-700"
          >
            {problem.title}
          </Link>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {showPrimaryPattern
              ? `${pattern?.name ?? "Pattern drill"} · `
              : ""}
            {problem.estimatedMinutes} min
          </p>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-bold ${difficultyStyles[problem.difficulty]}`}
        >
          {problem.difficulty}
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {problem.recognitionClues.slice(0, 3).map((clue) => (
          <span
            key={clue}
            className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
          >
            {clue}
          </span>
        ))}
      </div>
    </article>
  );
}
