"use client";

type RunButtonProps = {
  isRunning: boolean;
  structuredRunnerAvailable: boolean;
  executionAvailable: boolean;
  onRun: () => void;
};

export default function RunButton({
  isRunning,
  structuredRunnerAvailable,
  executionAvailable,
  onRun,
}: RunButtonProps) {
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={isRunning || !executionAvailable}
      className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {!executionAvailable
        ? "Execution Unavailable"
        : isRunning
        ? "Running..."
        : structuredRunnerAvailable
          ? "Run Custom Tests"
          : "Run Free-form Code"}
    </button>
  );
}
