"use client";

import { SignInButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useMemo, useState } from "react";

import { saveContrastDrillResultAction } from "@/app/drills/contrast/actions";
import {
  summarizeContrastDrillAnswers,
  type ContrastDrillAnswer,
  type ContrastDrillCard,
  type ContrastDrillData,
} from "@/lib/drills/contrast";

const difficultyStyles: Record<ContrastDrillCard["difficulty"], string> = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

type SaveState = "idle" | "saving" | "saved" | "error" | "signin";

export default function ContrastDrillClient({
  drill,
  recommendationId,
}: {
  drill: ContrastDrillData;
  recommendationId?: string;
}) {
  const { isSignedIn } = useAuth();
  const [answersByCardId, setAnswersByCardId] = useState<Record<string, string>>(
    {},
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const answers = useMemo<ContrastDrillAnswer[]>(
    () =>
      drill.cards
        .map((card) => ({
          cardId: card.id,
          selectedPatternId: answersByCardId[card.id],
        }))
        .filter(
          (answer): answer is ContrastDrillAnswer =>
            typeof answer.selectedPatternId === "string",
        ),
    [answersByCardId, drill.cards],
  );
  const isComplete = answers.length === drill.cards.length;
  const summary = useMemo(
    () => summarizeContrastDrillAnswers(drill, answers),
    [answers, drill],
  );

  function answerCard(cardId: string, selectedPatternId: string) {
    setAnswersByCardId((currentAnswers) => ({
      ...currentAnswers,
      [cardId]: selectedPatternId,
    }));
  }

  async function saveProgress() {
    if (!isSignedIn) {
      setSaveState("signin");
      return;
    }

    setSaveState("saving");

    const result = await saveContrastDrillResultAction({
      selectedPatternId: drill.selectedPatternId,
      correctPatternId: drill.correctPatternId,
      answers,
      accuracy: summary.accuracy,
      recommendationId,
    });

    setSaveState(result.status === "saved" ? "saved" : "error");
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Contrast Drill
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
            {drill.patternA.name} vs {drill.patternB.name}
          </h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-300">
            {drill.whyUsersConfuseThem}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <MiniStat label="Cards" value={drill.cards.length} />
            <MiniStat label="Answered" value={answers.length} />
            <MiniStat label="Accuracy" value={`${summary.accuracy}%`} />
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Key differences
          </p>
          <div className="mt-4 grid gap-3">
            {drill.keyDifferences.map((difference) => (
              <p
                key={difference}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-700"
              >
                {difference}
              </p>
            ))}
          </div>
        </section>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        {[drill.patternA, drill.patternB].map((pattern) => (
          <PatternReferenceCard key={pattern.id} pattern={pattern} />
        ))}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Quiz cards
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Choose the matching pattern
            </h2>
          </div>
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 shadow-sm">
            Correct pattern stays hidden until you answer.
          </span>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {drill.cards.map((card, index) => (
            <QuizCard
              key={card.id}
              card={card}
              index={index}
              patternAName={drill.patternA.name}
              patternBName={drill.patternB.name}
              patternAId={drill.patternA.id}
              patternBId={drill.patternB.id}
              selectedPatternId={answersByCardId[card.id]}
              onAnswer={answerCard}
            />
          ))}
        </div>
      </section>

      {isComplete ? (
        <section className="mt-8 rounded-lg border border-teal-200 bg-teal-50 p-6 shadow-sm">
          <div className="grid gap-5 lg:grid-cols-[0.75fr_0.25fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                Drill summary
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                {summary.correctCount}/{summary.answeredCount} correct ·{" "}
                {summary.accuracy}%
              </h2>
              <p className="mt-3 text-sm font-bold leading-6 text-teal-900">
                {summary.recommendedNextAction}
              </p>

              {summary.missedClues.length > 0 ? (
                <div className="mt-5">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                    Missed clues
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {summary.missedClues.map((clue) => (
                      <span
                        key={clue}
                        className="rounded-md border border-teal-200 bg-white px-2.5 py-1 text-xs font-bold text-teal-800"
                      >
                        {clue}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col justify-end gap-3">
              {isSignedIn ? (
                <button
                  type="button"
                  disabled={saveState === "saving" || saveState === "saved"}
                  onClick={() => void saveProgress()}
                  className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:opacity-60"
                >
                  {saveState === "saved"
                    ? "Progress Saved"
                    : saveState === "saving"
                      ? "Saving"
                      : "Save Drill Result"}
                </button>
              ) : (
                <SignInButton mode="modal">
                  <button className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
                    Sign in to Save
                  </button>
                </SignInButton>
              )}
              <Link
                href={`/forge?pattern=${drill.correctPatternId}`}
                className="rounded-lg border border-teal-200 bg-white px-4 py-3 text-center text-sm font-black text-slate-950 transition hover:bg-teal-100"
              >
                Start Focused Forge
              </Link>
              {saveState === "error" || saveState === "signin" ? (
                <p className="text-xs font-bold text-rose-700">
                  {saveState === "signin"
                    ? "Sign in before saving drill progress."
                    : "Could not save this drill result."}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function PatternReferenceCard({
  pattern,
}: {
  pattern: ContrastDrillData["patternA"];
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-2xl font-black tracking-tight text-slate-950">
        {pattern.name}
      </h2>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recognition clues
          </p>
          <ul className="mt-3 space-y-2">
            {pattern.recognitionClues.map((clue) => (
              <li
                key={clue}
                className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-600"
              >
                {clue}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-rose-700">
            Common mistakes
          </p>
          <ul className="mt-3 space-y-2">
            {pattern.commonMistakes.map((mistake) => (
              <li
                key={mistake}
                className="rounded-lg border border-rose-100 bg-rose-50 p-3 text-sm font-semibold leading-5 text-rose-700"
              >
                {mistake}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function QuizCard({
  card,
  index,
  patternAName,
  patternBName,
  patternAId,
  patternBId,
  selectedPatternId,
  onAnswer,
}: {
  card: ContrastDrillCard;
  index: number;
  patternAName: string;
  patternBName: string;
  patternAId: string;
  patternBId: string;
  selectedPatternId?: string;
  onAnswer: (cardId: string, selectedPatternId: string) => void;
}) {
  const hasAnswered = selectedPatternId !== undefined;
  const isCorrect = selectedPatternId === card.correctPatternId;
  const correctPatternName =
    card.correctPatternId === patternAId ? patternAName : patternBName;

  return (
    <article className="flex min-h-[390px] flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            Card 0{index + 1}
          </p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-slate-950">
            {card.title}
          </h3>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-black ${difficultyStyles[card.difficulty]}`}
        >
          {card.difficulty}
        </span>
      </div>

      <p className="mt-4 text-sm font-bold text-slate-600">{card.prompt}</p>

      <div className="mt-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Recognition clues
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {card.recognitionClues.map((clue) => (
            <span
              key={clue}
              className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
            >
              {clue}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {[
          { id: patternAId, name: patternAName },
          { id: patternBId, name: patternBName },
        ].map((pattern) => {
          const selected = selectedPatternId === pattern.id;

          return (
            <button
              key={pattern.id}
              type="button"
              disabled={hasAnswered}
              onClick={() => onAnswer(card.id, pattern.id)}
              className={`rounded-lg border px-4 py-3 text-sm font-black transition ${
                selected
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
              } disabled:cursor-default`}
            >
              {pattern.name}
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-5">
        {hasAnswered ? (
          <div
            className={`rounded-lg border p-3 text-sm font-bold leading-6 ${
              isCorrect
                ? "border-teal-200 bg-teal-50 text-teal-800"
                : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {isCorrect ? "Correct." : "Not quite."} This card points to{" "}
            {correctPatternName}.
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-bold text-slate-500">
            Correct pattern hidden until you answer.
          </div>
        )}

        <a
          href={card.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex w-full justify-center rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open on LeetCode
        </a>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-2 text-xl font-black text-white">{value}</p>
    </div>
  );
}
