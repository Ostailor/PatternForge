import type { HintLevel as HintLevelData } from "@/lib/ai/types";

type HintLevelProps = {
  hint: HintLevelData;
  isRevealed: boolean;
  canReveal: boolean;
  onReveal: () => void;
};

export default function HintLevel({
  hint,
  isRevealed,
  canReveal,
  onReveal,
}: HintLevelProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        isRevealed
          ? "border-teal-200 bg-teal-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            Hint {hint.level}
          </p>
          <h3 className="mt-1 text-sm font-black text-slate-950">
            {hint.title}
          </h3>
        </div>
        {!isRevealed ? (
          <button
            type="button"
            onClick={onReveal}
            disabled={!canReveal}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reveal
          </button>
        ) : null}
      </div>

      {isRevealed ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">
          {hint.hint}
        </p>
      ) : (
        <p className="mt-3 text-sm font-semibold text-slate-500">
          {canReveal ? "Ready to reveal." : "Reveal previous hints first."}
        </p>
      )}
    </div>
  );
}
