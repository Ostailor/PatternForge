import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { abandonBattleAction } from "@/app/battles/[battleId]/actions";
import BattleRoundClient from "@/app/battles/[battleId]/battle-round-client";
import type {
  DebugInsightView,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "@/components/code-workspace/types";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import { TestCaseSource } from "@/generated/prisma/client";
import { getRunnerConfig } from "@/lib/code-runner/runnerConfig";
import { getPrisma } from "@/lib/prisma";
import type { Problem } from "@/lib/types";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type BattleRunnerPageProps = {
  params: Promise<{ battleId: string }>;
};

type BattleForRunner = NonNullable<Awaited<ReturnType<typeof getBattleForRunner>>>;
type BattleRoundForRunner = BattleForRunner["rounds"][number];

type BattleWorkspaceData = {
  runnerConfigured: boolean;
  initialHistory: WorkspaceSubmissionHistoryItem[];
  initialTestCases: WorkspaceTestCaseItem[];
  initialDebugInsight: DebugInsightView | null;
};

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

function formatDate(date: Date | null): string {
  if (!date) {
    return "Recently";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function toPracticeProblem(round: BattleRoundForRunner): Problem {
  const primaryPatternId =
    round.problem.problemPatterns.find((problemPattern) => problemPattern.isPrimary)
      ?.patternId ?? round.expectedPatternId;

  return {
    id: round.problem.id,
    title: round.problem.title,
    url: round.problem.url,
    difficulty: round.problem.difficulty,
    estimatedMinutes: round.problem.estimatedMinutes,
    recognitionClues: round.problem.recognitionClues,
    commonMistakes: round.problem.commonMistakes,
    primaryPatternId,
    secondaryPatternIds: round.problem.problemPatterns
      .filter((problemPattern) => !problemPattern.isPrimary)
      .map((problemPattern) => problemPattern.patternId),
  };
}

async function getBattleForRunner(battleId: string, userProfileId: string) {
  return getPrisma().battle.findFirst({
    where: {
      id: battleId,
      userProfileId,
    },
    include: {
      targetPattern: true,
      rounds: {
        include: {
          attempt: {
            select: {
              id: true,
            },
          },
          problem: {
            include: {
              problemPatterns: true,
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

async function getRunnerConfigSafely(problemId: string) {
  try {
    return await getRunnerConfig(problemId, "Python");
  } catch {
    return null;
  }
}

async function getBattleSubmissionHistory({
  userProfileId,
  problemId,
  battleRoundId,
}: {
  userProfileId: string;
  problemId: string;
  battleRoundId: string;
}): Promise<WorkspaceSubmissionHistoryItem[]> {
  try {
    const submissions = await getPrisma().codeSubmission.findMany({
      where: {
        userProfileId,
        problemId,
        battleRoundId,
      },
      include: {
        codeRuns: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
    });

    return submissions.map((submission) => ({
      id: submission.id,
      language: "Python",
      status: submission.status,
      createdAt: submission.createdAt.toISOString(),
      updatedAt: submission.updatedAt.toISOString(),
      runCount: submission.codeRuns.length,
      latestRunStatus: submission.codeRuns[0]?.status ?? null,
    }));
  } catch {
    return [];
  }
}

async function getBattleTestCases({
  userProfileId,
  problemId,
}: {
  userProfileId: string;
  problemId: string;
}): Promise<WorkspaceTestCaseItem[]> {
  try {
    const testCases = await getPrisma().testCase.findMany({
      where: {
        problemId,
        OR: [
          {
            source: TestCaseSource.PatternForge,
            isPublic: true,
          },
          {
            source: TestCaseSource.User,
            userProfileId,
          },
        ],
      },
      orderBy: [
        {
          source: "asc",
        },
        {
          createdAt: "desc",
        },
      ],
      take: 10,
    });

    return testCases.map((testCase) => ({
      id: testCase.id,
      source: testCase.source,
      name: testCase.name,
      inputJson: testCase.inputJson,
      expectedOutputJson: testCase.expectedOutputJson,
      isPublic: testCase.isPublic,
      createdAt: testCase.createdAt.toISOString(),
      updatedAt: testCase.updatedAt.toISOString(),
    }));
  } catch {
    return [];
  }
}

async function getLatestBattleDebugInsight({
  userProfileId,
  problemId,
  battleRoundId,
}: {
  userProfileId: string;
  problemId: string;
  battleRoundId: string;
}): Promise<DebugInsightView | null> {
  try {
    const insight = await getPrisma().debugInsight.findFirst({
      where: {
        userProfileId,
        codeRun: {
          codeSubmission: {
            problemId,
            battleRoundId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return insight
      ? {
          id: insight.id,
          summary: insight.summary,
          likelyCause: insight.likelyCause,
          suggestedFix: insight.suggestedFix,
          followUpQuestion: insight.followUpQuestion,
          createdAt: insight.createdAt.toISOString(),
        }
      : null;
  } catch {
    return null;
  }
}

async function getBattleWorkspaceData({
  userProfileId,
  problemId,
  battleRoundId,
}: {
  userProfileId: string;
  problemId: string;
  battleRoundId: string;
}): Promise<BattleWorkspaceData> {
  const [runnerConfig, initialHistory, initialTestCases, initialDebugInsight] =
    await Promise.all([
      getRunnerConfigSafely(problemId),
      getBattleSubmissionHistory({
        userProfileId,
        problemId,
        battleRoundId,
      }),
      getBattleTestCases({
        userProfileId,
        problemId,
      }),
      getLatestBattleDebugInsight({
        userProfileId,
        problemId,
        battleRoundId,
      }),
    ]);

  return {
    runnerConfigured: Boolean(runnerConfig),
    initialHistory,
    initialTestCases,
    initialDebugInsight,
  };
}

export default async function BattleRunnerPage({
  params,
}: BattleRunnerPageProps) {
  const [{ battleId }, userProfile] = await Promise.all([
    params,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return <UnauthenticatedBattlePage />;
  }

  const battle = await getBattleForRunner(battleId, userProfile.id);

  if (!battle) {
    notFound();
  }

  if (battle.status === "Completed") {
    redirect(`/battles/${battle.id}/summary`);
  }

  if (battle.status === "Abandoned") {
    return <AbandonedBattlePage battle={battle} />;
  }

  const currentRound = battle.rounds.find((round) => !round.completedAt);

  if (!currentRound) {
    redirect(`/battles/${battle.id}/summary`);
  }

  const completedRoundCount = battle.rounds.filter((round) => round.completedAt)
    .length;
  const progress = Math.round(
    (completedRoundCount / battle.totalRounds) * 100,
  );
  const currentRoundNumber = currentRound.roundNumber;
  const isFinalRound = completedRoundCount + 1 >= battle.totalRounds;
  const problem = toPracticeProblem(currentRound);
  const workspaceData = await getBattleWorkspaceData({
    userProfileId: userProfile.id,
    problemId: currentRound.problemId,
    battleRoundId: currentRound.id,
  });

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
                {formatBattleType(battle.battleType)}
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {battle.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Round {currentRoundNumber} of {battle.totalRounds}:{" "}
                {formatRoundType(currentRound.roundType)}
              </p>
            </div>
            <form action={abandonBattleAction}>
              <input type="hidden" name="battleId" value={battle.id} />
              <button
                type="submit"
                className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50"
              >
                Abandon battle
              </button>
            </form>
          </div>
          <div className="mt-6">
            <ProgressBar value={progress} label="Battle progress" tone="indigo" />
          </div>
        </div>

        <BattleStatusPanel
          battle={battle}
          currentRound={currentRound}
          completedRoundCount={completedRoundCount}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <RoundList
          rounds={battle.rounds}
          currentRoundId={currentRound.id}
        />
        <BattleRoundClient
          battleId={battle.id}
          roundId={currentRound.id}
          problem={problem}
          patterns={patterns}
          isFinalRound={isFinalRound}
          workspaceData={workspaceData}
        />
      </section>
    </main>
  );
}

function BattleStatusPanel({
  battle,
  currentRound,
  completedRoundCount,
}: {
  battle: BattleForRunner;
  currentRound: BattleRoundForRunner;
  completedRoundCount: number;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
        Active run
      </p>
      <p className="mt-3 text-4xl font-black">
        {currentRound.roundNumber}/{battle.totalRounds}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
        {completedRoundCount} rounds completed. Started{" "}
        {formatDate(battle.startedAt)}.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Round type
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {formatRoundType(currentRound.roundType)}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Target
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {battle.targetPattern?.name ?? "Mixed patterns"}
          </p>
        </div>
      </div>
    </div>
  );
}

function RoundList({
  rounds,
  currentRoundId,
}: {
  rounds: BattleRoundForRunner[];
  currentRoundId: string;
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Battle rounds
      </p>
      <div className="mt-5 space-y-3">
        {rounds.map((round) => {
          const isCurrent = round.id === currentRoundId;
          const isComplete = Boolean(round.completedAt);

          return (
            <div
              key={round.id}
              className={`rounded-lg border p-3 ${
                isCurrent
                  ? "border-slate-950 bg-slate-950 text-white"
                  : isComplete
                    ? "border-teal-200 bg-teal-50 text-teal-800"
                    : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.14em]">
                    Round {round.roundNumber}
                  </p>
                  <p className="mt-1 text-sm font-black">
                    {formatRoundType(round.roundType)}
                  </p>
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {round.problem.title}
                  </p>
                </div>
                <span className="rounded-md border border-current px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] opacity-80">
                  {isComplete ? "Done" : isCurrent ? "Live" : "Queued"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AbandonedBattlePage({ battle }: { battle: BattleForRunner }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-700">
          Battle abandoned
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          {battle.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          This battle is closed. Start a new run when you are ready.
        </p>
        <Link
          href="/battles"
          className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Back to Battles
        </Link>
      </section>
    </main>
  );
}

function UnauthenticatedBattlePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Boss Battle
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to resume this battle
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Battle progress and attempts are private to your PatternForge account.
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
