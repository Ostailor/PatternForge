import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

import { patterns } from "@/data/patterns";
import { problems } from "@/data/problems";

import { submitDiagnosticAction } from "./actions";
import { diagnosticProblemIds } from "./diagnostic-data";

const diagnosticProblems = diagnosticProblemIds.map((problemId) => {
  const problem = problems.find((item) => item.id === problemId);

  if (!problem) {
    throw new Error(`Diagnostic problem ${problemId} is missing.`);
  }

  return problem;
});

export default async function OnboardingDiagnosticPage() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return <UnauthenticatedDiagnosticPage />;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          5-minute diagnostic
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Find your starting pattern
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          Answer a few recognition questions using PatternForge metadata only.
          No full problem statements are shown.
        </p>
      </section>

      <form action={submitDiagnosticAction} className="mt-6 space-y-5">
        {diagnosticProblems.map((problem, index) => (
          <section
            key={problem.id}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
                Pattern recognition {index + 1}
              </span>
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                {problem.difficulty}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-slate-950">
              {problem.title}
            </h2>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {problem.recognitionClues.map((clue) => (
                <p
                  key={clue}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-600"
                >
                  {clue}
                </p>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="text-sm font-black text-slate-950">
                Likely pattern
              </span>
              <select
                required
                name={`pattern:${problem.id}`}
                defaultValue=""
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
              >
                <option value="" disabled>
                  Choose a pattern
                </option>
                {patterns.map((pattern) => (
                  <option key={pattern.id} value={pattern.id}>
                    {pattern.name}
                  </option>
                ))}
              </select>
            </label>
          </section>
        ))}

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Confidence check
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            How confident are you recognizing coding interview patterns today?
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((value) => (
              <label
                key={value}
                className="flex cursor-pointer items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-black text-slate-700"
              >
                <span>{value}</span>
                <input
                  required
                  type="radio"
                  name="confidence"
                  value={value}
                  defaultChecked={value === 3}
                  className="h-4 w-4 accent-teal-600"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Experience check
          </p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
            What patterns do you already know?
          </h2>
          <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {patterns.map((pattern) => (
              <label
                key={pattern.id}
                className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
              >
                <input
                  type="checkbox"
                  name="knownPatterns"
                  value={pattern.id}
                  className="mt-1 h-4 w-4 accent-teal-600"
                />
                <span>
                  <span className="block text-sm font-black text-slate-950">
                    {pattern.name}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
                    {pattern.category}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold leading-6 text-slate-600">
            Submitting saves your diagnostic answers and generates a first
            learning plan.
          </p>
          <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            See Diagnostic Result
          </button>
        </div>
      </form>
    </main>
  );
}

function UnauthenticatedDiagnosticPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Diagnostic
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to take the diagnostic
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          PatternForge saves diagnostic answers and recommendations to your
          private account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
