"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  submitReviewAction,
  type SubmitReviewResult,
} from "@/app/review/actions";
import { XPToast } from "@/components/completion";
import type { ReviewItemType, ReviewRating } from "@/lib/review/types";

type ReviewQueueItemView = {
  id: string;
  itemType: ReviewItemType;
  patternId: string;
  patternName: string;
  problemTitle: string | null;
  prompt: string;
  answer: string;
  reviewDueAt: string;
  intervalDays: number;
  lapses: number;
};

type ReviewStatsView = {
  dueFlashcardsCount: number;
  dueMistakesCount: number;
  totalDueCount: number;
  reviewedTodayCount: number;
  retentionScore: number | null;
  weakestReviewPattern: {
    patternId: string;
    patternName: string;
    retentionScore: number;
  } | null;
};

type RecentReviewHistoryView = {
  id: string;
  itemType: ReviewItemType;
  rating: ReviewRating;
  reviewedAt: string;
  patternName: string | null;
  problemTitle: string | null;
};

type DailyReviewClientProps = {
  initialQueue: ReviewQueueItemView[];
  stats: ReviewStatsView;
  recentHistory: RecentReviewHistoryView[];
};

type CompletedReviewItem = {
  id: string;
  itemType: ReviewItemType;
  rating: ReviewRating;
  patternId: string | null;
  patternName: string;
  xpEarned: number;
};

const ratings: ReviewRating[] = ["Again", "Hard", "Good", "Easy"];

const ratingStyles: Record<ReviewRating, string> = {
  Again: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  Hard: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  Good: "border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100",
  Easy: "border-slate-300 bg-slate-950 text-white hover:bg-teal-700",
};

function calculateReviewXp(item: ReviewQueueItemView, rating: ReviewRating) {
  return (
    (item.itemType === "Flashcard" ? 5 : 0) +
    (item.itemType === "Mistake" ? 5 : 0) +
    (rating === "Good" ? 5 : 0) +
    (rating === "Easy" ? 10 : 0)
  );
}

function formatDate(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function DailyReviewClient({
  initialQueue,
  stats,
  recentHistory,
}: DailyReviewClientProps) {
  const [queue, setQueue] = useState(initialQueue);
  const [started, setStarted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [completedCount, setCompletedCount] = useState(0);
  const [sessionRatings, setSessionRatings] = useState<ReviewRating[]>([]);
  const [completedItems, setCompletedItems] = useState<CompletedReviewItem[]>(
    [],
  );
  const [remainingDueCount, setRemainingDueCount] = useState(
    stats.totalDueCount,
  );
  const currentItem = queue[0];
  const totalSessionItems = completedCount + queue.length;
  const progressPercent =
    totalSessionItems === 0
      ? 100
      : Math.round((completedCount / totalSessionItems) * 100);
  const sessionComplete = started && !currentItem;
  const sessionRatingSummary = useMemo(
    () =>
      ratings.map((rating) => ({
        rating,
        count: sessionRatings.filter((itemRating) => itemRating === rating)
          .length,
      })),
    [sessionRatings],
  );

  async function submitRating(rating: ReviewRating) {
    if (!currentItem || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    const result: SubmitReviewResult = await submitReviewAction({
      itemType: currentItem.itemType,
      itemId: currentItem.id,
      rating,
    });

    setIsSubmitting(false);

    if (result.status !== "saved") {
      setErrorMessage(
        result.status === "unauthenticated"
          ? "Sign in again to save this review."
          : result.message,
      );
      return;
    }

    setQueue((items) => items.slice(1));
    setCompletedCount((count) => count + 1);
    setSessionRatings((items) => [...items, rating]);
    setCompletedItems((items) => [
      ...items,
      {
        id: currentItem.id,
        itemType: currentItem.itemType,
        rating,
        patternId: currentItem.patternId,
        patternName: currentItem.patternName,
        xpEarned: calculateReviewXp(currentItem, rating),
      },
    ]);
    setRemainingDueCount(result.remainingDueCount);
    setRevealed(false);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Daily Review
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Lock patterns into memory
          </h1>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
            Clear due flashcards and mistake cards before starting a new forge
            session.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <ReviewStat label="Flashcards due" value={stats.dueFlashcardsCount} />
            <ReviewStat label="Mistakes due" value={stats.dueMistakesCount} />
            <ReviewStat label="Total due" value={stats.totalDueCount} />
            <ReviewStat label="Reviewed today" value={stats.reviewedTodayCount} />
          </div>
          <button
            type="button"
            onClick={() => setStarted(true)}
            disabled={initialQueue.length === 0}
            className="mt-5 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Review
          </button>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Retention
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight">
            {stats.retentionScore ?? 0}%
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            Recent review score across spaced repetition answers.
          </p>
          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Weakest review pattern
            </p>
            <p className="mt-2 text-lg font-black">
              {stats.weakestReviewPattern?.patternName ?? "No review history"}
            </p>
            {stats.weakestReviewPattern ? (
              <p className="mt-1 text-sm font-bold text-teal-300">
                {stats.weakestReviewPattern.retentionScore}% retention
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.42fr]">
        <div>
          {initialQueue.length === 0 ? (
            <EmptyReviewState />
          ) : sessionComplete ? (
            <ReviewSummary
              completedItems={completedItems}
              ratingSummary={sessionRatingSummary}
              remainingDueCount={remainingDueCount}
              weakestReviewPatternId={stats.weakestReviewPattern?.patternId}
            />
          ) : currentItem && started ? (
            <ReviewCard
              item={currentItem}
              revealed={revealed}
              isSubmitting={isSubmitting}
              completedCount={completedCount}
              totalSessionItems={totalSessionItems}
              progressPercent={progressPercent}
              errorMessage={errorMessage}
              onReveal={() => setRevealed(true)}
              onRate={submitRating}
            />
          ) : (
            <ReadyReviewState totalDueCount={stats.totalDueCount} />
          )}
        </div>

        <RecentReviewHistory history={recentHistory} />
      </section>
    </main>
  );
}

function ReadyReviewState({ totalDueCount }: { totalDueCount: number }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Ready
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {totalDueCount} item{totalDueCount === 1 ? "" : "s"} waiting
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        Start the queue when you are ready. Each card reveals the answer or
        correction before you choose a rating.
      </p>
    </section>
  );
}

function ReviewCard({
  item,
  revealed,
  isSubmitting,
  completedCount,
  totalSessionItems,
  progressPercent,
  errorMessage,
  onReveal,
  onRate,
}: {
  item: ReviewQueueItemView;
  revealed: boolean;
  isSubmitting: boolean;
  completedCount: number;
  totalSessionItems: number;
  progressPercent: number;
  errorMessage: string;
  onReveal: () => void;
  onRate: (rating: ReviewRating) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {item.itemType}
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Review {completedCount + 1} of {totalSessionItems}
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          Due {formatDate(item.reviewDueAt)}
        </span>
      </div>

      <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-teal-600 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          <span>{item.patternName}</span>
          {item.problemTitle ? <span>· {item.problemTitle}</span> : null}
        </div>
        {item.itemType === "Flashcard" ? (
          <>
            <p className="mt-4 text-xl font-black leading-8 text-slate-950">
              {item.prompt}
            </p>
            {revealed ? (
              <p className="mt-4 rounded-lg border border-teal-200 bg-white p-4 text-sm font-bold leading-6 text-slate-700">
                {item.answer}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mt-4 text-sm font-black uppercase tracking-[0.14em] text-amber-700">
              Mistake
            </p>
            <p className="mt-2 text-base font-bold leading-7 text-slate-800">
              {item.prompt}
            </p>
            {revealed ? (
              <>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.14em] text-teal-700">
                  Correction
                </p>
                <p className="mt-2 rounded-lg border border-teal-200 bg-white p-4 text-sm font-bold leading-6 text-slate-700">
                  {item.answer}
                </p>
              </>
            ) : null}
          </>
        )}
      </div>

      {!revealed ? (
        <button
          type="button"
          onClick={onReveal}
          className="mt-5 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          {item.itemType === "Flashcard" ? "Show Answer" : "Show Correction"}
        </button>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-4">
          {ratings.map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onRate(rating)}
              disabled={isSubmitting}
              className={`rounded-lg border px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${ratingStyles[rating]}`}
            >
              {rating}
            </button>
          ))}
        </div>
      )}

      {errorMessage ? (
        <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">
          {errorMessage}
        </p>
      ) : null}
    </section>
  );
}

function ReviewSummary({
  completedItems,
  ratingSummary,
  remainingDueCount,
  weakestReviewPatternId,
}: {
  completedItems: CompletedReviewItem[];
  ratingSummary: { rating: ReviewRating; count: number }[];
  remainingDueCount: number;
  weakestReviewPatternId?: string;
}) {
  const flashcardsReviewed = completedItems.filter(
    (item) => item.itemType === "Flashcard",
  ).length;
  const mistakesReviewed = completedItems.filter(
    (item) => item.itemType === "Mistake",
  ).length;
  const patternsReviewed = Array.from(
    new Set(completedItems.map((item) => item.patternName)),
  ).sort((a, b) => a.localeCompare(b));
  const fallbackPatternId = completedItems.find((item) => item.patternId)
    ?.patternId;
  const practicePatternId = weakestReviewPatternId ?? fallbackPatternId;
  const reviewedXp = completedItems.reduce(
    (total, item) => total + item.xpEarned,
    0,
  );
  const clearQueueBonus = remainingDueCount === 0 ? 10 : 0;
  const xpEarned = reviewedXp + clearQueueBonus;
  const completedCount = completedItems.length;

  return (
    <section className="overflow-hidden rounded-lg border border-teal-200 bg-white shadow-sm">
      <div className="border-b border-teal-100 bg-teal-50 p-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Review complete
        </p>
        <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          {remainingDueCount === 0
            ? "Forge complete. Your memory is sharper today."
            : `${completedCount} item${completedCount === 1 ? "" : "s"} reviewed`}
        </h2>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          {remainingDueCount === 0
            ? "You cleared the due queue and pushed today's memory work forward."
            : "Strong pass. A few more due reviews are still waiting when you are ready."}
        </p>
      </div>

      <div className="p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ReviewStat label="Flashcards reviewed" value={flashcardsReviewed} />
          <ReviewStat label="Mistakes reviewed" value={mistakesReviewed} />
          <ReviewStat label="XP earned" value={xpEarned} />
          <ReviewStat label="Items rescheduled" value={completedCount} />
        </div>

        <div className="mt-5">
          <XPToast
            title={`Review session complete: ${completedCount} item${
              completedCount === 1 ? "" : "s"
            }`}
            xpAmount={xpEarned}
            description={
              remainingDueCount === 0
                ? "Daily Review is clear. Next move: practice the weakest pattern while retention is fresh."
                : "Next move: review the remaining due cards or practice the weakest reviewed pattern."
            }
            nextActionLabel={
              remainingDueCount > 0 ? "Review More" : "Start Focused Practice"
            }
            nextActionHref={
              remainingDueCount > 0
                ? "/review?continue=1"
                : practicePatternId
                  ? `/forge?pattern=${practicePatternId}`
                  : "/forge"
            }
          />
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Ratings breakdown
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2">
              {ratingSummary.map((item) => (
                <ReviewStat
                  key={item.rating}
                  label={item.rating}
                  value={item.count}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Patterns reviewed
            </p>
            {patternsReviewed.length === 0 ? (
              <p className="mt-3 text-sm font-bold leading-6 text-slate-500">
                No patterns were reviewed in this session.
              </p>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {patternsReviewed.map((patternName) => (
                  <span
                    key={patternName}
                    className="rounded-md border border-teal-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-teal-700"
                  >
                    {patternName}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-5 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Rescheduled
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {completedCount} item{completedCount === 1 ? "" : "s"} moved to
              their next review interval.
              {clearQueueBonus > 0 ? " Clear queue bonus included." : ""}
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/"
            className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back to Dashboard
          </Link>
          {remainingDueCount > 0 ? (
            <Link
              href="/review?continue=1"
              className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
            >
              Review More
            </Link>
          ) : null}
          <Link
            href={
              practicePatternId ? `/forge?pattern=${practicePatternId}` : "/forge"
            }
            className="rounded-lg bg-teal-700 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-slate-950"
          >
            Practice Weakest Pattern
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyReviewState() {
  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Queue clear
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        Nothing is due right now
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        New flashcards and mistake cards will appear here when their review date
        arrives.
      </p>
    </section>
  );
}

function RecentReviewHistory({
  history,
}: {
  history: RecentReviewHistoryView[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            History
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            Recent reviews
          </h2>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          {history.length}
        </span>
      </div>

      {history.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-500">
          Completed reviews will show up here.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {history.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-black text-slate-950">
                  {item.patternName ?? item.itemType}
                </p>
                <span className="rounded-md bg-white px-2 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                  {item.rating}
                </span>
              </div>
              <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                {item.problemTitle ?? item.itemType} ·{" "}
                {formatDate(item.reviewedAt)}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}
