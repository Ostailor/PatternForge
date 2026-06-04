"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

import { FeedbackType } from "@/generated/prisma/enums";
import { submitFeedbackAction } from "@/app/feedback-actions";

const feedbackTypeOptions: { value: FeedbackType; label: string }[] = [
  { value: FeedbackType.Bug, label: "Bug" },
  { value: FeedbackType.Confusing, label: "Confusing UX" },
  { value: FeedbackType.FeatureRequest, label: "Feature request" },
  { value: FeedbackType.Praise, label: "Praise" },
  { value: FeedbackType.Other, label: "Other" },
];

const appVersion = process.env.NEXT_PUBLIC_PATTERNFORGE_VERSION ?? "0.0.0";

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>(FeedbackType.Bug);
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | undefined>();
  const [resultMessage, setResultMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const trimmedMessage = message.trim();
  const pagePath = useMemo(() => pathname || "/", [pathname]);

  function resetForm() {
    setFeedbackType(FeedbackType.Bug);
    setMessage("");
    setRating(undefined);
    setResultMessage("");
    setIsSuccess(false);
  }

  function closeModal() {
    setIsOpen(false);
    resetForm();
  }

  function submitFeedback() {
    setResultMessage("");

    startTransition(async () => {
      const result = await submitFeedbackAction({
        feedbackType,
        pagePath,
        message: trimmedMessage,
        rating,
        appVersion,
      });

      if (result.status === "saved") {
        setIsSuccess(true);
        setResultMessage("Thanks. Your feedback was sent.");
        setMessage("");
        setRating(undefined);
        return;
      }

      setIsSuccess(false);
      setResultMessage(result.message);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-lg shadow-slate-900/10 transition hover:border-teal-300 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2"
      >
        Feedback
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-4 backdrop-blur-sm sm:place-items-center"
        >
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                  Beta feedback
                </p>
                <h2
                  id="feedback-title"
                  className="mt-2 text-2xl font-black tracking-tight text-slate-950"
                >
                  Tell us what happened
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-500 transition hover:bg-slate-50 hover:text-slate-950"
                aria-label="Close feedback"
              >
                X
              </button>
            </div>

            {isSuccess ? (
              <div className="p-5">
                <div className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                  <p className="text-lg font-black text-teal-900">
                    Feedback sent
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-teal-800">
                    Thanks for helping improve PatternForge for beta users.
                  </p>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                className="p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitFeedback();
                }}
              >
                <label className="block">
                  <span className="text-sm font-black text-slate-950">
                    Feedback type
                  </span>
                  <select
                    value={feedbackType}
                    onChange={(event) =>
                      setFeedbackType(event.target.value as FeedbackType)
                    }
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
                  >
                    {feedbackTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block">
                  <span className="text-sm font-black text-slate-950">
                    Message
                  </span>
                  <textarea
                    required
                    minLength={8}
                    maxLength={2000}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the bug, confusing flow, or idea. Do not paste code, transcripts, passwords, or private data."
                    className="mt-2 min-h-32 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-700"
                  />
                </label>

                <div className="mt-4">
                  <p className="text-sm font-black text-slate-950">
                    Rating optional
                  </p>
                  <div className="mt-2 grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          setRating((current) =>
                            current === value ? undefined : value,
                          )
                        }
                        className={`rounded-lg border px-3 py-2 text-sm font-black transition ${
                          rating === value
                            ? "border-teal-600 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="mt-4 text-xs font-semibold leading-5 text-slate-500">
                  Sent with page path {pagePath} and app version {appVersion}.
                  No code, transcripts, or raw workspace content is attached
                  automatically.
                </p>

                {resultMessage ? (
                  <p
                    className={`mt-4 rounded-lg border p-3 text-sm font-bold ${
                      isSuccess
                        ? "border-teal-200 bg-teal-50 text-teal-800"
                        : "border-amber-200 bg-amber-50 text-amber-900"
                    }`}
                  >
                    {resultMessage}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isPending || trimmedMessage.length < 8}
                    className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {isPending ? "Sending..." : "Submit Feedback"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
