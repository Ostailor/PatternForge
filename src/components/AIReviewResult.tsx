import type { SavedAIReview } from "@/lib/ai/types";

type AIReviewResultProps = {
  review: SavedAIReview;
};

const scoreItems = [
  ["Pattern Score", "patternScore"],
  ["Implementation Score", "implementationScore"],
  ["Complexity Check", "complexityScore"],
  ["Explanation Score", "explanationScore"],
] as const;

export default function AIReviewResult({ review }: AIReviewResultProps) {
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Review complete
          </p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Coach Review
          </h3>
          <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Overall summary
          </p>
          <p className="mt-2 max-w-3xl text-sm font-bold leading-6 text-slate-700">
            {review.feedbackSummary}
          </p>
        </div>
        <p className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
          {new Date(review.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        {scoreItems.map(([label, key]) => (
          <div
            key={label}
            className="rounded-lg border border-teal-200 bg-white p-3"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-3xl font-black text-slate-950">
              {review[key]}/10
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ReviewList title="Strengths" items={review.strengths} tone="teal" />
        <ReviewList title="Weaknesses" items={review.weaknesses} tone="amber" />
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Complexity feedback
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {review.complexityFeedback}
        </p>
      </div>

      {review.suggestedMistakes.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Mistakes
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.suggestedMistakes.map((mistake) => (
              <div
                key={`${mistake.mistakeType}-${mistake.description}`}
                className="rounded-lg border border-amber-200 bg-white p-4"
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
                  {review.patternName} · {review.problemTitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {review.suggestedFlashcards.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Flashcards
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {review.suggestedFlashcards.map((flashcard) => (
              <div
                key={`${flashcard.front}-${flashcard.back}`}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="text-sm font-black text-slate-950">
                    {flashcard.front}
                  </p>
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-teal-700">
                    Flashcard Created
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {flashcard.back}
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {review.patternName} · {review.problemTitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Next Training Move
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-slate-950">
          {review.suggestedNextStep}
        </p>
      </div>
    </div>
  );
}

function ReviewList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "teal" | "amber";
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p
        className={`text-xs font-black uppercase tracking-[0.14em] ${
          tone === "teal" ? "text-teal-700" : "text-amber-700"
        }`}
      >
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm font-semibold text-slate-500">
          No items returned.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => (
            <li
              key={item}
              className="text-sm font-semibold leading-6 text-slate-700"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
