import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";

import {
  startMixedBattleAction,
  startPatternBossAction,
  startReviewGauntletAction,
} from "@/app/battles/actions";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import MasteryBadge from "@/components/MasteryBadge";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import {
  canStartPatternBoss,
  isMixedBattleRecommended,
  isReviewGauntletRecommended,
  summarizeBattleStats,
} from "@/lib/battles/dashboard";
import {
  getMasteryLevel,
  getMasteryLevelNumber,
  isMasterTier,
} from "@/lib/mastery";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { getAttempts } from "@/lib/progress";
import { getCurrentUserProgressSnapshot } from "@/lib/progress-db";
import type { PatternProgress } from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const STARTER_PATTERN_ID = "arrays-hashing";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

type BattlesPageProps = {
  searchParams?: SearchParams;
};

type BattleDashboardData = Awaited<ReturnType<typeof getBattleDashboardData>>;
type ActiveBattle = NonNullable<BattleDashboardData["activeBattle"]>;
type CompletedBattle = BattleDashboardData["recentCompletedBattles"][number];

function getSingleSearchParam(
  searchParams: Record<string, string | string[] | undefined> | undefined,
  key: string,
): string | null {
  const value = searchParams?.[key];

  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(date: Date | null): string {
  if (!date) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatBattleType(battleType: string): string {
  switch (battleType) {
    case "PatternBoss":
      return "Pattern Boss";
    case "MixedBattle":
      return "Mixed Battle";
    case "ReviewGauntlet":
      return "Review Gauntlet";
    default:
      return battleType;
  }
}

function formatRoundType(roundType: string): string {
  return roundType.replace(/([A-Z])/g, " $1").trim();
}

function getPatternProgressRows(
  patternProgressById: Record<string, PatternProgress> | null,
  problemCountByPatternId: Map<string, number>,
) {
  return patterns.map((pattern) => {
    const progress = patternProgressById?.[pattern.id] ?? {
      patternId: pattern.id,
      recognitionCorrect: 0,
      recognitionAttempts: 0,
      solvedCount: 0,
      attemptedCount: 0,
      masteryScore: 0,
      explanationScore: null,
      retentionScore: null,
      confidenceScore: null,
      lastPracticedAt: undefined,
    };

    return {
      pattern,
      progress,
      masteryLevel: getMasteryLevel(progress.masteryScore),
      levelNumber: getMasteryLevelNumber(progress.masteryScore),
      isMasterTier: isMasterTier(progress.masteryScore),
      problemCount: problemCountByPatternId.get(pattern.id) ?? 0,
    };
  });
}

async function getPatternProblemCounts() {
  const rows = await getPrisma().problemPattern.findMany({
    where: {
      isPrimary: true,
    },
    select: {
      patternId: true,
    },
  });

  return rows.reduce((counts, row) => {
    counts.set(row.patternId, (counts.get(row.patternId) ?? 0) + 1);

    return counts;
  }, new Map<string, number>());
}

async function getReviewSignalCount(userProfileId: string) {
  const prisma = getPrisma();
  const [mistakeCount, reviewCount] = await Promise.all([
    prisma.mistake.count({
      where: {
        userProfileId,
      },
    }),
    prisma.reviewLog.count({
      where: {
        userProfileId,
      },
    }),
  ]);

  return mistakeCount + reviewCount;
}

function getUniqueAttemptedProblemCount(attempts: ReturnType<typeof getAttempts>) {
  return new Set(attempts.map((attempt) => attempt.problemId)).size;
}

function getDefaultBattlePatternId(
  patternRows: ReturnType<typeof getPatternProgressRows>,
) {
  return (
    patternRows.find((row) => row.pattern.id === STARTER_PATTERN_ID && row.problemCount > 0)
      ?.pattern.id ??
    patternRows.find((row) => row.problemCount > 0)?.pattern.id ??
    STARTER_PATTERN_ID
  );
}

async function getBattleDashboardData(userProfileId: string) {
  const prisma = getPrisma();
  const [
    activeBattle,
    recentCompletedBattles,
    completedBattles,
    reviewSignalCount,
  ] =
    await Promise.all([
      prisma.battle.findFirst({
        where: {
          userProfileId,
          status: "Active",
        },
        include: {
          targetPattern: true,
          rounds: {
            include: {
              problem: true,
            },
            orderBy: {
              roundNumber: "asc",
            },
          },
        },
        orderBy: {
          startedAt: "desc",
        },
      }),
      prisma.battle.findMany({
        where: {
          userProfileId,
          status: "Completed",
        },
        include: {
          targetPattern: true,
          rounds: {
            include: {
              attempt: {
                select: {
                  wasPatternCorrect: true,
                },
              },
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
        take: 5,
      }),
      prisma.battle.findMany({
        where: {
          userProfileId,
          status: "Completed",
        },
        include: {
          targetPattern: true,
          rounds: {
            include: {
              attempt: {
                select: {
                  wasPatternCorrect: true,
                },
              },
            },
          },
        },
        orderBy: {
          completedAt: "desc",
        },
      }),
      getReviewSignalCount(userProfileId),
    ]);
  const stats = summarizeBattleStats(
    completedBattles.map((battle) => ({
      battleType: battle.battleType,
      result: battle.result,
      targetPatternName: battle.targetPattern?.name,
      rounds: battle.rounds.map((round) => ({
        wasPatternCorrect: round.attempt?.wasPatternCorrect ?? null,
      })),
    })),
  );

  return {
    activeBattle,
    recentCompletedBattles,
    stats,
    reviewSignalCount,
  };
}

export default async function BattlesPage({ searchParams }: BattlesPageProps) {
  if (!getFeatureFlag("bossBattles")) {
    return (
      <FeatureUnavailable
        eyebrow="Boss Battles"
        title="Boss Battles are unavailable"
        description="Pressure-test practice is turned off for this beta environment. You can still use Daily Forge, reviews, and regular pattern practice."
      />
    );
  }

  const [userProfile, resolvedSearchParams] = await Promise.all([
    ensureCurrentUserProfile(),
    searchParams,
  ]);

  if (!userProfile) {
    return <UnauthenticatedBattlesPage />;
  }

  const [snapshot, patternProblemCounts, battleData] = await Promise.all([
    getCurrentUserProgressSnapshot(),
    getPatternProblemCounts(),
    getBattleDashboardData(userProfile.id),
  ]);
  const attempts = getAttempts(snapshot.progress ?? undefined);
  const uniqueAttemptedProblemCount = getUniqueAttemptedProblemCount(attempts);
  const mixedRecommended = isMixedBattleRecommended(uniqueAttemptedProblemCount);
  const reviewGauntletRecommended = isReviewGauntletRecommended(
    battleData.reviewSignalCount,
  );
  const hasActiveBattle = battleData.activeBattle !== null;
  const patternRows = getPatternProgressRows(
    snapshot.patternProgressById,
    patternProblemCounts,
  );
  const availablePatternCount = patternRows.filter((row) =>
    canStartPatternBoss(row.problemCount),
  ).length;
  const canStartAnyPatternBoss = availablePatternCount > 0 && !hasActiveBattle;
  const defaultPatternId = getDefaultBattlePatternId(patternRows);
  const error = getSingleSearchParam(resolvedSearchParams, "error");

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            PatternForge v0.4
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Boss Battles
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Test your pattern mastery under pressure.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Battle readiness
          </p>
          <p className="mt-3 text-4xl font-black">
            {uniqueAttemptedProblemCount}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            Unique problems attempted. Mixed Battle is recommended after 5.
          </p>
          <div className="mt-5">
            <ProgressBar
              value={Math.min(
                Math.round((uniqueAttemptedProblemCount / 5) * 100),
                100,
              )}
              tone="indigo"
            />
          </div>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            {availablePatternCount} Pattern Boss lanes available
          </p>
        </div>
      </section>

      {error ? <BattleAlert error={error} /> : null}

      {!mixedRecommended || !reviewGauntletRecommended ? (
        <BattleGuidanceNotice
          availablePatternCount={availablePatternCount}
          uniqueAttemptedProblemCount={uniqueAttemptedProblemCount}
          reviewSignalCount={battleData.reviewSignalCount}
          mixedRecommended={mixedRecommended}
          reviewGauntletRecommended={reviewGauntletRecommended}
        />
      ) : null}

      {battleData.activeBattle ? (
        <ActiveBattleCard battle={battleData.activeBattle} />
      ) : null}

      <section id="battle-options" className="mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
              Battle options
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Choose your next pressure test
            </h2>
          </div>
          {hasActiveBattle ? (
            <span className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Active battle in progress
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-[1.35fr_0.82fr_0.82fr]">
          <PatternBossCard
            patternRows={patternRows}
            defaultPatternId={defaultPatternId}
            canStart={canStartAnyPatternBoss}
          />
          <BattleOptionCard
            title="Mixed Battle"
            description="Combines practiced patterns across mastered, in-progress, and weak lanes."
            action={startMixedBattleAction}
            buttonLabel="Start Mixed Battle"
            disabled={hasActiveBattle}
            badge="Multiple patterns"
            recommended={mixedRecommended}
            guidance={
              mixedRecommended
                ? "Recommended now based on your practice history."
                : "Available now, but strongest after 5 attempted problems."
            }
          />
          <BattleOptionCard
            title="Review Gauntlet"
            description="Based on recent mistakes, hard reviews, and low-retention practice signals."
            action={startReviewGauntletAction}
            buttonLabel="Start Review Gauntlet"
            disabled={hasActiveBattle}
            badge="Review signals"
            recommended={reviewGauntletRecommended}
            guidance={
              reviewGauntletRecommended
                ? "Recommended now from your mistake and review signals."
                : "Available now, but sharper after 3 mistakes or reviews."
            }
          />
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Battles completed"
          value={battleData.stats.battlesCompleted}
          detail="Finished battle runs"
        />
        <StatCard
          label="Victories"
          value={battleData.stats.victories}
          detail="Full battle wins"
        />
        <StatCard
          label="Partial victories"
          value={battleData.stats.partialVictories}
          detail="Strong but incomplete clears"
        />
        <StatCard
          label="Avg recognition"
          value={`${battleData.stats.averageRecognitionAccuracy}%`}
          detail="Battle round attempts"
        />
        <StatCard
          label="Best boss pattern"
          value={battleData.stats.bestBossPattern}
          detail="Pattern Boss results"
        />
      </section>

      <RecentCompletedBattles battles={battleData.recentCompletedBattles} />
    </main>
  );
}

function BattleAlert({ error }: { error: string }) {
  const message =
    error === "disabled"
      ? "Boss Battles are temporarily unavailable."
      : error === "locked"
      ? "Build a little more practice history before starting this battle."
      : error === "signin"
        ? "Sign in before creating or resuming battles."
        : "That battle is not available with the current seeded problem bank.";

  return (
    <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
      {message}
    </div>
  );
}

function BattleGuidanceNotice({
  availablePatternCount,
  uniqueAttemptedProblemCount,
  reviewSignalCount,
  mixedRecommended,
  reviewGauntletRecommended,
}: {
  availablePatternCount: number;
  uniqueAttemptedProblemCount: number;
  reviewSignalCount: number;
  mixedRecommended: boolean;
  reviewGauntletRecommended: boolean;
}) {
  return (
    <section className="mt-6 rounded-lg border border-teal-200 bg-teal-50 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Battle guidance
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        Start small, then raise the pressure.
      </h2>
      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
        Pattern Boss is available for any pattern with at least one seeded
        problem. Mixed Battle is best after 5 attempted problems, and Review
        Gauntlet is best after 3 mistakes or reviews. You can still start them
        early if you want a pressure test.
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <GuidanceStat
          label="Pattern Boss lanes"
          value={availablePatternCount}
          detail="Need 1 seeded problem"
          ready={availablePatternCount > 0}
        />
        <GuidanceStat
          label="Mixed readiness"
          value={`${uniqueAttemptedProblemCount}/5`}
          detail="Attempted problems"
          ready={mixedRecommended}
        />
        <GuidanceStat
          label="Gauntlet signals"
          value={`${reviewSignalCount}/3`}
          detail="Mistakes or reviews"
          ready={reviewGauntletRecommended}
        />
      </div>
    </section>
  );
}

function GuidanceStat({
  label,
  value,
  detail,
  ready,
}: {
  label: string;
  value: string | number;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-lg border border-teal-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{detail}</p>
        </div>
        <span
          className={`rounded-md border px-2 py-1 text-[0.65rem] font-black uppercase tracking-[0.12em] ${
            ready
              ? "border-teal-200 bg-teal-50 text-teal-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {ready ? "Ready" : "Warm up"}
        </span>
      </div>
    </div>
  );
}

function ActiveBattleCard({ battle }: { battle: ActiveBattle }) {
  const completedRounds = battle.rounds.filter((round) => round.completedAt)
    .length;
  const progress =
    battle.totalRounds === 0
      ? 0
      : Math.round((completedRounds / battle.totalRounds) * 100);

  return (
    <section
      id="active-battle"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Active battle
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {battle.title}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {formatBattleType(battle.battleType)}
            {battle.targetPattern ? ` · ${battle.targetPattern.name}` : ""} ·
            started {formatDate(battle.startedAt)}
          </p>
        </div>
        <Link
          href={`/battles/${battle.id}`}
          className="rounded-lg bg-slate-950 px-4 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
        >
          Resume Battle
        </Link>
      </div>

      <div className="mt-5">
        <ProgressBar value={progress} label="Battle progress" tone="indigo" />
      </div>

      <div id="active-battle-rounds" className="mt-5 grid gap-3 lg:grid-cols-5">
        {battle.rounds.map((round) => (
          <div
            key={round.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Round {round.roundNumber}
            </p>
            <p className="mt-2 text-sm font-black text-slate-950">
              {formatRoundType(round.roundType)}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
              {round.problem.title}
            </p>
            <span className="mt-3 inline-flex rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
              {round.problem.difficulty}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function PatternBossCard({
  patternRows,
  defaultPatternId,
  canStart,
}: {
  patternRows: ReturnType<typeof getPatternProgressRows>;
  defaultPatternId: string;
  canStart: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Pattern Boss
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Duel one pattern
          </h3>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
          3-5 rounds
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        Choose a target pattern and fight through warmup, twist, review, and
        boss rounds.
      </p>

      <form action={startPatternBossAction} className="mt-5 space-y-4">
        <label
          htmlFor="patternId"
          className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500"
        >
          Target pattern
        </label>
        <select
          id="patternId"
          name="patternId"
          defaultValue={defaultPatternId}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-800 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
        >
          {patternRows.map(({ pattern, progress, levelNumber, problemCount }) => (
            <option
              key={pattern.id}
              value={pattern.id}
              disabled={!canStartPatternBoss(problemCount)}
            >
              {pattern.name} · L{levelNumber} · {progress.masteryScore}%
              mastery · {problemCount} problems
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!canStart}
          className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Start Pattern Boss
        </button>
      </form>

      <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-1">
        {patternRows.map(
          ({ pattern, progress, masteryLevel, levelNumber, isMasterTier, problemCount }) => (
          <div
            key={pattern.id}
            className={`rounded-lg border p-4 ${
              isMasterTier
                ? "border-indigo-200 bg-indigo-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-slate-950">{pattern.name}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  {progress.attemptedCount} attempts · {progress.solvedCount}{" "}
                  solved · {problemCount} seeded
                </p>
              </div>
              <MasteryBadge
                level={masteryLevel}
                levelNumber={levelNumber}
                score={progress.masteryScore}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                  canStartPatternBoss(problemCount)
                    ? "border-teal-200 bg-white text-teal-700"
                    : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                {canStartPatternBoss(problemCount)
                  ? "Boss available"
                  : "Needs seeded problem"}
              </span>
              {isMasterTier ? (
                <span className="rounded-md border border-indigo-200 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] text-indigo-700">
                  Master-tier
                </span>
              ) : null}
            </div>
            <div className="mt-3">
              <ProgressBar value={progress.masteryScore} />
            </div>
          </div>
          ),
        )}
      </div>
    </div>
  );
}

function BattleOptionCard({
  title,
  description,
  action,
  buttonLabel,
  disabled,
  badge,
  recommended,
  guidance,
}: {
  title: string;
  description: string;
  action: () => Promise<void>;
  buttonLabel: string;
  disabled: boolean;
  badge: string;
  recommended: boolean;
  guidance: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            {title}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {badge}
          </h3>
        </div>
        <span
          className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-[0.12em] ${
            recommended
              ? "border-teal-200 bg-teal-50 text-teal-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          {recommended ? "Recommended" : "Optional"}
        </span>
      </div>
      <p className="mt-3 min-h-24 text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold leading-5 text-slate-600">
        {guidance}
      </p>
      <form action={action} className="mt-5">
        <button
          type="submit"
          disabled={disabled}
          className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 break-words text-3xl font-black leading-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function RecentCompletedBattles({ battles }: { battles: CompletedBattle[] }) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Recent completed battles
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Battle history
          </h2>
        </div>
      </div>

      {battles.length === 0 ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Completed battles will appear here after your first run.
        </p>
      ) : (
        <div className="mt-5 grid gap-3">
          {battles.map((battle) => (
            <div
              key={battle.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-black text-slate-950">{battle.title}</p>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  {formatBattleType(battle.battleType)}
                  {battle.targetPattern ? ` · ${battle.targetPattern.name}` : ""} ·
                  {formatDate(battle.completedAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/battles/${battle.id}/summary`}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Summary
                </Link>
                <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                  {battle.result ?? "Completed"}
                </span>
                <span className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700">
                  +{battle.xpEarned} XP
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function UnauthenticatedBattlesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Boss Battles
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Test your pattern mastery under pressure.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Sign in to create, resume, and save battle results to your
            PatternForge account.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <SignInButton mode="modal">
              <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
                Sign in
              </button>
            </SignInButton>
            <Link
              href="/patterns"
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Preview Patterns
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Preview
          </p>
          <h2 className="mt-4 text-3xl font-black tracking-tight">
            Boss Battles are account-bound.
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Battle creation and resume actions require authentication so XP,
            attempts, and results stay private to the signed-in user.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 md:grid-cols-3">
        {[
          ["Pattern Boss", "Choose one pattern and fight a focused boss set."],
          ["Mixed Battle", "Combine practiced patterns in one pressure run."],
          ["Review Gauntlet", "Turn recent review trouble spots into a battle."],
        ].map(([title, description]) => (
          <div
            key={title}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              {title}
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {description}
            </p>
            <button
              type="button"
              disabled
              className="mt-5 w-full cursor-not-allowed rounded-lg bg-slate-300 px-4 py-3 text-sm font-black text-white"
            >
              Sign in to start
            </button>
          </div>
        ))}
      </section>
    </main>
  );
}
