import Link from "next/link";

import MasteryBadge from "./MasteryBadge";
import ProgressBar from "./ProgressBar";
import type { MasteryLevel, Pattern } from "@/lib/types";

const accents = [
  "from-teal-500 to-cyan-500",
  "from-rose-500 to-orange-400",
  "from-amber-400 to-yellow-300",
  "from-indigo-500 to-sky-500",
];

type PatternCardProps = {
  pattern: Pattern;
  masteryLevel?: MasteryLevel;
  progress?: number;
  problemCount?: number;
  recognitionClueCount?: number;
};

export default function PatternCard({
  pattern,
  masteryLevel = "Not Started",
  progress = 0,
  problemCount = 0,
  recognitionClueCount = 3,
}: PatternCardProps) {
  const accent = accents[(pattern.levelOrder - 1) % accents.length];

  return (
    <article className="group flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <div className={`mb-5 h-1.5 w-16 rounded-full bg-gradient-to-r ${accent}`} />
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-950">
            {pattern.name}
          </h3>
          <p className="mt-1 text-sm font-medium text-slate-500">
            {pattern.category} · {problemCount} seeded problems
          </p>
        </div>
        <MasteryBadge level={masteryLevel} score={progress} />
      </div>
      <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
        {pattern.description}
      </p>
      <div className="mt-5 space-y-2">
        {pattern.recognitionClues.slice(0, recognitionClueCount).map((clue) => (
          <p
            key={clue}
            className="rounded-md bg-slate-50 px-3 py-2 text-xs font-semibold leading-5 text-slate-600"
          >
            {clue}
          </p>
        ))}
      </div>
      <div className="mt-6">
        <ProgressBar value={progress} label="Mastery" />
      </div>
      <Link
        href={`/patterns/${pattern.id}`}
        className="mt-5 inline-flex justify-center rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700"
      >
        View pattern
      </Link>
    </article>
  );
}
