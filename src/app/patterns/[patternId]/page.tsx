import Link from "next/link";
import { notFound } from "next/navigation";

import { getPatternById, patterns } from "@/data/patterns";
import { problems } from "@/data/problems";
import {
  PatternMasteryBadge,
  PatternMasteryBar,
  PatternProgressPanel,
} from "./progress-client";

type PatternDetailPageProps = {
  params: Promise<{ patternId: string }>;
};

const difficultyStyles = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

export function generateStaticParams() {
  return patterns.map((pattern) => ({
    patternId: pattern.id,
  }));
}

export default async function PatternDetailPage({
  params,
}: PatternDetailPageProps) {
  const { patternId } = await params;
  const pattern = getPatternById(patternId);

  if (!pattern) {
    notFound();
  }

  const relatedProblems = problems.filter(
    (problem) => problem.primaryPatternId === pattern.id,
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
                  {pattern.category}
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  {pattern.name}
                </h1>
              </div>
              <PatternMasteryBadge patternId={pattern.id} />
            </div>

            <p className="mt-5 text-base leading-7 text-slate-600">
              {pattern.description}
            </p>

            <div className="mt-6">
              <PatternMasteryBar patternId={pattern.id} />
            </div>

            <Link
              href={`/forge?pattern=${pattern.id}`}
              className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
            >
              Start focused forge
            </Link>
          </div>

          <PatternProgressPanel patternId={pattern.id} />
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black tracking-tight text-slate-950">
              Recognition clues
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {pattern.recognitionClues.map((clue) => (
                <div
                  key={clue}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700"
                >
                  {clue}
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-tight text-slate-950">
                Template summary
              </h2>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {pattern.templateSummary}
              </p>
            </div>

            <div className="rounded-lg border border-rose-100 bg-rose-50 p-6 shadow-sm">
              <h2 className="text-xl font-black tracking-tight text-rose-950">
                Common mistakes
              </h2>
              <ul className="mt-4 space-y-3">
                {pattern.commonMistakes.map((mistake) => (
                  <li
                    key={mistake}
                    className="text-sm font-semibold leading-6 text-rose-700"
                  >
                    {mistake}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Related problems
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Problems where this pattern is the seeded primary pattern.
            </p>
          </div>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            {relatedProblems.length} problems
          </span>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {relatedProblems.map((problem) => {
            const secondaryPatterns = problem.secondaryPatternIds
              .map((secondaryPatternId) => getPatternById(secondaryPatternId))
              .filter((secondaryPattern) => secondaryPattern !== undefined);

            return (
              <article
                key={problem.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-950">
                      {problem.title}
                    </h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {problem.estimatedMinutes} min
                    </p>
                  </div>
                  <span
                    className={`rounded-md border px-2.5 py-1 text-xs font-bold ${difficultyStyles[problem.difficulty]}`}
                  >
                    {problem.difficulty}
                  </span>
                </div>

                {secondaryPatterns.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {secondaryPatterns.map((secondaryPattern) => (
                      <span
                        key={secondaryPattern.id}
                        className="rounded-md bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700"
                      >
                        {secondaryPattern.name}
                      </span>
                    ))}
                  </div>
                ) : null}

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

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href={`/problems/${problem.id}`}
                    className="rounded-lg bg-slate-950 px-4 py-2.5 text-center text-sm font-black text-white transition hover:bg-teal-700"
                  >
                    Practice
                  </Link>
                  <a
                    href={problem.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Open on LeetCode
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
