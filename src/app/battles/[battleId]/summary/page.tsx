import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import AIReviewPanel from "@/components/AIReviewPanel";
import {
  AchievementToast,
  BattleResultBadge,
  QuestCompletedCard,
  XPToast,
} from "@/components/completion";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { toAppAttempt } from "@/lib/progress-db";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type BattleSummaryPageProps = {
  params: Promise<{ battleId: string }>;
};

type BattleForSummary = NonNullable<Awaited<ReturnType<typeof getBattleForSummary>>>;
type RoundForSummary = BattleForSummary["rounds"][number];
type GameEventForSummary = Awaited<ReturnType<typeof getBattleRewardEvents>>[number];

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

function formatResult(result: string | null): string {
  switch (result) {
    case "Victory":
      return "Victory";
    case "PartialVictory":
      return "Partial Victory";
    case "Defeat":
      return "Defeat";
    default:
      return "Incomplete";
  }
}

function getResultCopy(result: string | null): string {
  switch (result) {
    case "Victory":
      return "Boss defeated. Your pattern recognition held under pressure.";
    case "PartialVictory":
      return "You survived the battle. Review the weak spots and come back sharper.";
    case "Defeat":
      return "The forge exposed your weak spots. That is useful data.";
    default:
      return "Finish the battle to lock in your result.";
  }
}

function formatRoundType(roundType: string): string {
  return roundType.replace(/([A-Z])/g, " $1").trim();
}

function toSolvedStatusLabel(solvedStatus: string | undefined): string {
  switch (solvedStatus) {
    case "Solved":
      return "Solved";
    case "PartiallySolved":
      return "Partially Solved";
    case "NotSolved":
      return "Not Solved";
    default:
      return "No attempt";
  }
}

function getReflectionPreview(reflection: string | undefined): string {
  if (!reflection?.trim()) {
    return "No reflection saved.";
  }

  return reflection.trim().replace(/\s+/g, " ").slice(0, 180);
}

function getRoundExecutionSummary(round: RoundForSummary) {
  const runs = round.codeSubmissions
    .flatMap((submission) => submission.codeRuns)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  const latestRun = runs.at(-1);
  const latestTestResults = latestRun?.testResults ?? [];
  const failedTestResults = latestTestResults.filter(
    (testResult) => !testResult.passed,
  );
  const customTestRuns = runs.filter((run) => run.runType === "CustomTests");
  const latestCustomRun = customTestRuns.at(-1);
  const latestUserTestResults =
    latestCustomRun?.testResults.filter(
      (testResult) => testResult.testCase?.source === "User",
    ) ?? [];
  const userTestCaseIds = new Set(
    latestUserTestResults
      .map((testResult) => testResult.testCaseId)
      .filter((testCaseId): testCaseId is string => Boolean(testCaseId)),
  );

  return {
    latestStatus: latestRun?.status ?? null,
    testsPassed: latestTestResults.length - failedTestResults.length,
    testsFailed: failedTestResults.length,
    runtimeError: latestRun?.errorMessage ?? null,
    debugInsightCount: runs.reduce(
      (total, run) => total + run.debugInsights.length,
      0,
    ),
    hasSuccessfulCustomTestRun: customTestRuns.some(
      (run) => run.status === "Succeeded",
    ),
    userCreatedTestCount: userTestCaseIds.size,
    allUserCustomTestsPassed:
      userTestCaseIds.size > 0 &&
      latestUserTestResults.every((testResult) => testResult.passed),
  };
}

function getExecutionBonusXp(rounds: RoundForSummary[]): number {
  const summaries = rounds.map(getRoundExecutionSummary);

  return (
    (summaries.some((summary) => summary.hasSuccessfulCustomTestRun) ? 10 : 0) +
    (summaries.some((summary) => summary.allUserCustomTestsPassed) ? 10 : 0) +
    (summaries.reduce(
      (total, summary) => total + summary.userCreatedTestCount,
      0,
    ) >= 2
      ? 5
      : 0)
  );
}

function readMetadataId(
  event: GameEventForSummary,
  key: "questId" | "achievementId",
): string | null {
  const metadata = event.metadata;

  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];

  return typeof value === "string" ? value : null;
}

function isBattleRewardEvent(event: GameEventForSummary, battleId: string): boolean {
  const metadata = event.metadata;

  return (
    typeof metadata === "object" &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    metadata.battleId === battleId
  );
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

function getWeakestPatternId(rounds: RoundForSummary[]): string | null {
  const standing = new Map<
    string,
    { patternId: string; misses: number; attempts: number }
  >();

  for (const round of rounds) {
    const patternId =
      round.attempt?.correctPatternId ?? round.expectedPatternId ?? null;

    if (!patternId || !round.attempt) {
      continue;
    }

    const current = standing.get(patternId) ?? {
      patternId,
      misses: 0,
      attempts: 0,
    };

    current.attempts += 1;

    if (
      !round.attempt.wasPatternCorrect ||
      round.attempt.solvedStatus === "NotSolved"
    ) {
      current.misses += 1;
    }

    standing.set(patternId, current);
  }

  return (
    Array.from(standing.values()).sort(
      (a, b) =>
        b.misses - a.misses ||
        b.attempts - a.attempts ||
        a.patternId.localeCompare(b.patternId),
    )[0]?.patternId ?? null
  );
}

async function getBattleForSummary(battleId: string, userProfileId: string) {
  return getPrisma().battle.findFirst({
    where: {
      id: battleId,
      userProfileId,
    },
    include: {
      targetPattern: true,
      rounds: {
        include: {
          expectedPattern: true,
          problem: true,
          attempt: {
            include: {
              selectedPattern: true,
              correctPattern: true,
            },
          },
          codeSubmissions: {
            include: {
              codeRuns: {
                orderBy: {
                  createdAt: "asc",
                },
                include: {
                  testResults: {
                    orderBy: {
                      createdAt: "asc",
                    },
                    include: {
                      testCase: {
                        select: {
                          source: true,
                        },
                      },
                    },
                  },
                  debugInsights: true,
                },
              },
            },
          },
        },
        orderBy: {
          roundNumber: "asc",
        },
      },
    },
  });
}

async function getBattleRewardEvents(userProfileId: string) {
  return getPrisma().gameEvent.findMany({
    where: {
      userProfileId,
      eventType: {
        in: ["QuestCompleted", "AchievementEarned"],
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });
}

async function getBattleArtifacts({
  userProfileId,
  battleId,
  attemptIds,
}: {
  userProfileId: string;
  battleId: string;
  attemptIds: string[];
}) {
  const prisma = getPrisma();
  const [mistakes, flashcards, rewardEvents] = await Promise.all([
    prisma.mistake.findMany({
      where: {
        userProfileId,
        attemptId: {
          in: attemptIds,
        },
      },
      include: {
        problem: true,
        pattern: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    prisma.flashcard.findMany({
      where: {
        userProfileId,
        sourceAttemptId: {
          in: attemptIds,
        },
      },
      include: {
        pattern: true,
        sourceAttempt: {
          include: {
            problem: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    getBattleRewardEvents(userProfileId),
  ]);
  const battleRewardEvents = rewardEvents.filter((event) =>
    isBattleRewardEvent(event, battleId),
  );
  const achievementIds = battleRewardEvents
    .filter((event) => event.eventType === "AchievementEarned")
    .map((event) => readMetadataId(event, "achievementId"))
    .filter((id): id is string => id !== null);
  const questIds = battleRewardEvents
    .filter((event) => event.eventType === "QuestCompleted")
    .map((event) => readMetadataId(event, "questId"))
    .filter((id): id is string => id !== null);
  const [achievements, quests] = await Promise.all([
    achievementIds.length > 0
      ? prisma.achievement.findMany({
          where: {
            id: {
              in: achievementIds,
            },
          },
        })
      : [],
    questIds.length > 0
      ? prisma.quest.findMany({
          where: {
            id: {
              in: questIds,
            },
          },
        })
      : [],
  ]);

  return {
    mistakes,
    flashcards,
    achievements: uniqueById(achievements),
    quests: uniqueById(quests),
  };
}

export default async function BattleSummaryPage({
  params,
}: BattleSummaryPageProps) {
  const [{ battleId }, userProfile] = await Promise.all([
    params,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return <UnauthenticatedSummaryPage />;
  }

  const battle = await getBattleForSummary(battleId, userProfile.id);

  if (!battle) {
    notFound();
  }

  if (battle.status === "Active") {
    redirect(`/battles/${battle.id}`);
  }

  const aiCoachEnabled = getFeatureFlag("aiCoach");
  const completedRounds = battle.rounds.filter((round) => round.attempt);
  const attemptIds = completedRounds
    .map((round) => round.attempt?.id)
    .filter((id): id is string => Boolean(id));
  const correctRecognitionCount = completedRounds.filter(
    (round) => round.attempt?.wasPatternCorrect,
  ).length;
  const solvedProblemCount = completedRounds.filter(
    (round) => round.attempt?.solvedStatus === "Solved",
  ).length;
  const partiallySolvedProblemCount = completedRounds.filter(
    (round) => round.attempt?.solvedStatus === "PartiallySolved",
  ).length;
  const recognitionAccuracy =
    battle.totalRounds === 0
      ? 0
      : Math.round((correctRecognitionCount / battle.totalRounds) * 100);
  const averageConfidence =
    completedRounds.length === 0
      ? 0
      : completedRounds.reduce(
          (total, round) => total + (round.attempt?.confidence ?? 0),
          0,
        ) / completedRounds.length;
  const testedPatterns = uniqueById(
    completedRounds
      .map((round) => round.attempt?.correctPattern ?? round.expectedPattern)
      .filter((pattern): pattern is NonNullable<typeof pattern> =>
        Boolean(pattern),
      ),
  );
  const weakestPatternId = getWeakestPatternId(battle.rounds);
  const weakestPattern = testedPatterns.find(
    (pattern) => pattern.id === weakestPatternId,
  );
  const finalAttempt = completedRounds.at(-1)?.attempt;
  const executionBonusXp = getExecutionBonusXp(battle.rounds);
  const artifacts = await getBattleArtifacts({
    userProfileId: userProfile.id,
    battleId: battle.id,
    attemptIds,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Battle summary
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            {battle.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            {getResultCopy(battle.result)}
          </p>
          <div className="mt-5">
            <BattleResultBadge result={battle.result} xpEarned={battle.xpEarned} />
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
            >
              Back to Dashboard
            </Link>
            <Link
              href="/battles"
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Start Another Battle
            </Link>
            <Link
              href="/mistakes"
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Review Mistakes
            </Link>
            <Link
              href={weakestPattern ? `/patterns/${weakestPattern.id}` : "/patterns"}
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Practice Weakest Pattern
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Result
          </p>
          <p className="mt-3 text-4xl font-black">
            {formatResult(battle.result)}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            {formatBattleType(battle.battleType)}
            {battle.targetPattern ? ` · ${battle.targetPattern.name}` : ""}
          </p>
          <p className="mt-5 text-5xl font-black text-teal-300">
            +{battle.xpEarned}
          </p>
          <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-slate-400">
            XP earned
          </p>
        </div>
      </section>

      <section className="mt-6">
        <XPToast
          title={`${formatResult(battle.result)}: ${battle.title}`}
          xpAmount={battle.xpEarned}
          description="Next move: review any new mistake cards, then start another battle when the weak spot is clear."
          nextActionLabel="Review Mistakes"
          nextActionHref="/mistakes"
        />
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryStat
          label="Rounds completed"
          value={`${completedRounds.length}/${battle.totalRounds}`}
          detail="Battle rounds with saved attempts"
        />
        <SummaryStat
          label="Recognition accuracy"
          value={`${recognitionAccuracy}%`}
          detail={`${correctRecognitionCount} correct pattern reads`}
        />
        <SummaryStat
          label="Problems solved"
          value={solvedProblemCount}
          detail={`${partiallySolvedProblemCount} partially solved`}
        />
        <SummaryStat
          label="Average confidence"
          value={averageConfidence.toFixed(1)}
          detail="Self-rated attempt confidence"
        />
        <SummaryStat
          label="Execution bonus"
          value={`+${executionBonusXp}`}
          detail="Optional PatternForge custom-test XP"
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <PatternPanel patterns={testedPatterns} weakestPatternName={weakestPattern?.name} />
        <RewardPanel
          achievements={artifacts.achievements}
          quests={artifacts.quests}
        />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <MistakePanel mistakes={artifacts.mistakes} />
        <FlashcardPanel flashcards={artifacts.flashcards} />
      </section>

      <RoundBreakdown rounds={battle.rounds} />

      {finalAttempt ? (
        <div className="mt-6">
          <AIReviewPanel
            attempt={toAppAttempt(finalAttempt)}
            enabled={aiCoachEnabled}
          />
        </div>
      ) : null}
    </main>
  );
}

function SummaryStat({
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
      <p className="mt-3 text-3xl font-black leading-tight text-slate-950">
        {value}
      </p>
      <p className="mt-2 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function PatternPanel({
  patterns,
  weakestPatternName,
}: {
  patterns: { id: string; name: string; category: string }[];
  weakestPatternName?: string;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Patterns tested
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {patterns.length === 0 ? (
          <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
            No completed rounds
          </span>
        ) : (
          patterns.map((pattern) => (
            <span
              key={pattern.id}
              className="rounded-md border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-teal-700"
            >
              {pattern.name}
            </span>
          ))
        )}
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
        Weakest pattern:{" "}
        <span className="font-black text-slate-950">
          {weakestPatternName ?? "No weak pattern yet"}
        </span>
      </p>
    </section>
  );
}

function RewardPanel({
  achievements,
  quests,
}: {
  achievements: { id: string; name: string; icon: string; xpReward: number }[];
  quests: { id: string; title: string; xpReward: number }[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Rewards unlocked
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <RewardList
          title="Achievements earned"
          emptyText="No achievements earned from this battle."
          items={achievements.map((achievement) => ({
            id: achievement.id,
            node: (
              <AchievementToast
                name={achievement.name}
                icon={achievement.icon}
                xpAmount={achievement.xpReward}
                nextActionLabel="View Badge"
                nextActionHref="/achievements"
              />
            ),
          }))}
        />
        <RewardList
          title="Quests completed"
          emptyText="No quests completed from this battle."
          items={quests.map((quest) => ({
            id: quest.id,
            node: (
              <QuestCompletedCard
                title={quest.title}
                xpAmount={quest.xpReward}
                description="Daily quest progress has been locked in."
                nextActionLabel="Back to Dashboard"
                nextActionHref="/"
              />
            ),
          }))}
        />
      </div>
    </section>
  );
}

function RewardList({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: { id: string; node: ReactNode }[];
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {items.length === 0 ? (
          <p className="text-sm font-semibold leading-6 text-slate-500">
            {emptyText}
          </p>
        ) : (
          items.map((item) => (
            <div key={item.id}>{item.node}</div>
          ))
        )}
      </div>
    </div>
  );
}

function MistakePanel({
  mistakes,
}: {
  mistakes: {
    id: string;
    mistakeType: string;
    description: string;
    problem: { title: string };
    pattern: { name: string };
  }[];
}) {
  return (
    <ArtifactPanel
      title="Mistakes created"
      emptyText="No AI Coach mistakes were created from this battle yet."
      items={mistakes.map((mistake) => ({
        id: mistake.id,
        title: mistake.mistakeType,
        detail: `${mistake.problem.title} · ${mistake.pattern.name}`,
        body: mistake.description,
      }))}
    />
  );
}

function FlashcardPanel({
  flashcards,
}: {
  flashcards: {
    id: string;
    front: string;
    pattern: { name: string };
    sourceAttempt: { problem: { title: string } } | null;
  }[];
}) {
  return (
    <ArtifactPanel
      title="Flashcards created"
      emptyText="No AI Coach flashcards were created from this battle yet."
      items={flashcards.map((flashcard) => ({
        id: flashcard.id,
        title: flashcard.front,
        detail: `${flashcard.sourceAttempt?.problem.title ?? "Battle attempt"} · ${flashcard.pattern.name}`,
      }))}
    />
  );
}

function ArtifactPanel({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: { id: string; title: string; detail: string; body?: string }[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>
      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500">
            {emptyText}
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <p className="font-black text-slate-950">{item.title}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-teal-700">
                {item.detail}
              </p>
              {item.body ? (
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {item.body}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RoundBreakdown({ rounds }: { rounds: RoundForSummary[] }) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        Round-by-round breakdown
      </p>
      <div className="mt-5 grid gap-3">
        {rounds.map((round) => {
          const execution = getRoundExecutionSummary(round);

          return (
            <div
              key={round.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    Round {round.roundNumber} · {formatRoundType(round.roundType)}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-tight text-slate-950">
                    {round.problem.title}
                  </h2>
                  <p className="mt-1 text-sm font-bold text-slate-500">
                    {round.problem.difficulty}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <RoundPill
                    label={
                      round.attempt?.wasPatternCorrect
                        ? "Recognition correct"
                        : "Recognition miss"
                    }
                    tone={round.attempt?.wasPatternCorrect ? "teal" : "amber"}
                  />
                  <RoundPill
                    label={toSolvedStatusLabel(round.attempt?.solvedStatus)}
                    tone={round.attempt?.solvedStatus === "Solved" ? "teal" : "slate"}
                  />
                  <RoundPill
                    label={
                      execution.latestStatus
                        ? `Run ${execution.latestStatus}`
                        : "No code run"
                    }
                    tone={
                      execution.latestStatus === "Succeeded"
                        ? "teal"
                        : execution.latestStatus
                          ? "amber"
                          : "slate"
                    }
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Detail
                  label="Selected pattern"
                  value={round.attempt?.selectedPattern.name ?? "No selection"}
                />
                <Detail
                  label="Correct pattern"
                  value={
                    round.attempt?.correctPattern.name ??
                    round.expectedPattern.name
                  }
                />
                <Detail
                  label="Confidence"
                  value={
                    round.attempt ? `${round.attempt.confidence}/5` : "No attempt"
                  }
                />
                <Detail
                  label="Reflection preview"
                  value={getReflectionPreview(round.attempt?.reflection)}
                />
                <Detail
                  label="Custom tests"
                  value={
                    execution.latestStatus
                      ? `${execution.testsPassed} passed, ${execution.testsFailed} failed`
                      : "Not run"
                  }
                />
                <Detail
                  label="Runtime errors"
                  value={execution.runtimeError ?? "None recorded"}
                />
                <Detail
                  label="User tests"
                  value={`${execution.userCreatedTestCount} saved custom test${
                    execution.userCreatedTestCount === 1 ? "" : "s"
                  }`}
                />
                <Detail
                  label="Debug insights"
                  value={`${execution.debugInsightCount} generated`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RoundPill({
  label,
  tone,
}: {
  label: string;
  tone: "teal" | "amber" | "slate";
}) {
  const styles = {
    teal: "border-teal-200 bg-teal-50 text-teal-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    slate: "border-slate-200 bg-white text-slate-600",
  }[tone];

  return (
    <span
      className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${styles}`}
    >
      {label}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-bold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function UnauthenticatedSummaryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Battle summary
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to view this summary
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Battle results are private to your PatternForge account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
