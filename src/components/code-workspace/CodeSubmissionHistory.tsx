"use client";

import type { WorkspaceSubmissionHistoryItem } from "./types";

type CodeSubmissionHistoryProps = {
  items: WorkspaceSubmissionHistoryItem[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CodeSubmissionHistory({
  items,
}: CodeSubmissionHistoryProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        History
      </p>
      <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
        Code submissions
      </h2>
      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
            Saved code and self-test runs will appear here.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-slate-950">
                  {item.language} · {item.status}
                </p>
                <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-black text-slate-600">
                  {item.latestRunStatus ?? "Draft"}
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {formatDate(item.createdAt)} · {item.runCount} run
                {item.runCount === 1 ? "" : "s"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
