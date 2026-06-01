import { SignInButton } from "@clerk/nextjs";

import {
  getCurrentUserReviewDashboard,
  type ReviewDashboardData,
} from "@/lib/ai-review-db";

export default async function ReviewPage() {
  const data = await getCurrentUserReviewDashboard();

  if (!data) {
    return <UnauthenticatedReviewPage />;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Coach Review
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Training archive
        </h1>
        <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
          Review your recent Coach Reviews, mistakes forged from feedback, and
          simple flashcards created for retention.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ArchiveStat label="Coach Reviews" value={data.aiReviews.length} />
          <ArchiveStat label="Mistakes Forged" value={data.mistakes.length} />
          <ArchiveStat label="Flashcards Created" value={data.flashcards.length} />
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <AIReviewHistory reviews={data.aiReviews} />
        <MistakeCards mistakes={data.mistakes} />
      </section>

      <Flashcards flashcards={data.flashcards} />
    </main>
  );
}

function UnauthenticatedReviewPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Coach Review
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
          Not signed in
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          AI reviews, mistake cards, and flashcards are saved to your account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}

function AIReviewHistory({
  reviews,
}: {
  reviews: ReviewDashboardData["aiReviews"];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Coach Review
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Recent reviews
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {reviews.length}
        </span>
      </div>

      {reviews.length === 0 ? (
        <EmptyState text="No AI reviews yet. Complete a problem attempt, then request an AI Coach review from the summary page." />
      ) : (
        <div className="mt-5 grid gap-4">
          {reviews.map((review) => (
            <article
              key={review.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-950">
                    {review.problemTitle}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {review.patternName} ·{" "}
                    {new Date(review.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                {review.feedbackSummary}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Score label="Pattern Score" value={review.patternScore} />
                <Score
                  label="Implementation Score"
                  value={review.implementationScore}
                />
                <Score label="Complexity Check" value={review.complexityScore} />
                <Score label="Explanation Score" value={review.explanationScore} />
              </div>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Next Training Move
              </p>
              <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold leading-6 text-slate-700">
                {review.suggestedNextStep}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MistakeCards({
  mistakes,
}: {
  mistakes: ReviewDashboardData["mistakes"];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Mistake Forged
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Recent mistakes
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {mistakes.length}
        </span>
      </div>

      {mistakes.length === 0 ? (
        <EmptyState text="No mistake cards yet. AI Coach can create them after reviewing a saved attempt." />
      ) : (
        <div className="mt-5 grid gap-4">
          {mistakes.map((mistake) => (
            <article
              key={mistake.id}
              className="rounded-lg border border-amber-200 bg-amber-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-black text-amber-700">
                  {mistake.mistakeType}
                </p>
                <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                  Mistake Forged
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                {mistake.description}
              </p>
              <p className="mt-2 text-sm font-bold leading-6 text-slate-950">
                {mistake.correction}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {mistake.patternName} · {mistake.problemTitle}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Flashcards({
  flashcards,
}: {
  flashcards: ReviewDashboardData["flashcards"];
}) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Flashcard Created
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Simple retention cards
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {flashcards.length}
        </span>
      </div>

      {flashcards.length === 0 ? (
        <EmptyState text="No flashcards yet. They stay simple in v0.2: front, back, pattern, and source problem only." />
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {flashcards.map((flashcard) => (
            <article
              key={flashcard.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="text-sm font-black text-slate-950">
                  {flashcard.front}
                </p>
                <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-teal-700">
                  Flashcard Created
                </span>
              </div>
              <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
                {flashcard.back}
              </p>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {flashcard.patternName} ·{" "}
                {flashcard.sourceProblemTitle ?? "No source attempt"}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}/10</p>
    </div>
  );
}

function ArchiveStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5">
      <p className="text-sm font-bold leading-6 text-slate-500">{text}</p>
    </div>
  );
}
