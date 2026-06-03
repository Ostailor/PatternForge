import type { Attempt, ForgeSessionSummary, Pattern, Problem } from "@/lib/types";
import { LevelUpCard, XPToast } from "@/components/completion";
import { calculateAttemptXp } from "@/lib/game/xp";
import type {
  DebugInsightView,
  WorkspaceRunSummary,
} from "@/components/code-workspace/types";

type SessionSummaryProps = {
  summary?: Pick<
    ForgeSessionSummary,
    "attempted" | "solved" | "averageConfidence"
  >;
  attempt?: Attempt;
  problem?: Problem;
  correctPattern?: Pattern;
  levelUp?: {
    patternName: string;
    levelName: string;
    levelNumber: number;
  } | null;
  codeRunSummary?: WorkspaceRunSummary | null;
  latestDebugInsight?: DebugInsightView | null;
};

export default function SessionSummary({
  summary,
  attempt,
  problem,
  correctPattern,
  levelUp,
  codeRunSummary,
  latestDebugInsight,
}: SessionSummaryProps) {
  if (attempt && problem) {
    const xpEarned = calculateAttemptXp(attempt);

    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Session Summary
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Attempt forged
            </h2>
            <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
              {problem.title}
            </p>
          </div>
          <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Saved
          </span>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Recognition
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.wasPatternCorrect ? "Correct" : "Review"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Solved
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.solvedStatus}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Confidence
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {attempt.confidence}/5
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Code Run
            </p>
            {codeRunSummary ? (
              <>
                <p className="mt-2 text-xl font-black text-slate-950">
                  {codeRunSummary.status}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  {codeRunSummary.testsPassed} custom tests passed,{" "}
                  {codeRunSummary.testsFailed} failed.
                  {codeRunSummary.errorMessage
                    ? ` Error: ${codeRunSummary.errorMessage}`
                    : ""}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                No code run recorded for this attempt. You can still request AI
                review with pasted code or explanation.
              </p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Debug Insight
            </p>
            {latestDebugInsight ? (
              <>
                <p className="mt-2 text-sm font-black text-slate-950">
                  {latestDebugInsight.summary}
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                  {latestDebugInsight.suggestedFix}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm font-bold leading-6 text-slate-600">
                No Debug Coach insight generated in this session.
              </p>
            )}
          </div>
        </div>
        {codeRunSummary?.status === "Succeeded" &&
        codeRunSummary.testsPassed > 0 &&
        codeRunSummary.testsFailed === 0 ? (
          <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
              Custom tests passed
            </p>
            <p className="mt-2 text-sm font-bold leading-6 text-teal-800">
              Your PatternForge self-tests passed. This is not an official
              correctness result.
            </p>
            <a
              href={problem.url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
            >
              Try on LeetCode
            </a>
          </div>
        ) : null}
        <div className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            Next Training Move
          </p>
          <p className="mt-2 text-sm font-bold leading-6 text-teal-800">
            Review the correct pattern, then use Coach Review if you want
            feedback on your implementation. Correct pattern:{" "}
            {correctPattern?.name ?? "Unknown"}.
          </p>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <XPToast
            title={`Attempt complete: ${problem.title}`}
            xpAmount={xpEarned}
            description="Your saved reflection updated XP, streaks, quests, achievements, and pattern mastery."
            nextActionLabel="Review with AI Coach"
            nextActionHref="#ai-coach"
          />
          {correctPattern ? (
            <LevelUpCard
              patternName={levelUp?.patternName ?? correctPattern.name}
              levelName={levelUp?.levelName}
              levelNumber={levelUp?.levelNumber}
              isLevelUp={Boolean(levelUp)}
              description={
                levelUp
                  ? `Pattern level up: ${levelUp.patternName} is now ${levelUp.levelName}.`
                  : "Pattern mastery was recalculated from this attempt. Keep the next rep focused on the same recognition cues."
              }
              nextActionLabel="Practice This Pattern"
              nextActionHref={`/forge?pattern=${correctPattern.id}`}
            />
          ) : null}
        </div>
      </section>
    );
  }

  if (!summary) {
    return null;
  }

  const stats = [
    { label: "Attempts", value: summary.attempted },
    { label: "Solved", value: summary.solved },
    { label: "Confidence", value: summary.averageConfidence.toFixed(1) },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
            {stat.label}
          </p>
          <p
            className="mt-2 text-2xl font-black text-slate-950"
            suppressHydrationWarning
          >
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
