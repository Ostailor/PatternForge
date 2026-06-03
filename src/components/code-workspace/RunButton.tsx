"use client";

type RunButtonProps = {
  isRunning: boolean;
  structuredRunnerAvailable: boolean;
  onRun: () => void;
};

export default function RunButton({
  isRunning,
  structuredRunnerAvailable,
  onRun,
}: RunButtonProps) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={isRunning}
      className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isRunning
        ? "Running..."
        : structuredRunnerAvailable
          ? "Run Custom Tests"
          : "Run Free-form Code"}
    </button>
  );
}
