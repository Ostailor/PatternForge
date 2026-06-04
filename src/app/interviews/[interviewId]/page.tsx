import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { CodeWorkspace } from "@/components/code-workspace";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import type {
  DebugInsightView,
  WorkspaceContext,
  WorkspaceSubmissionHistoryItem,
  WorkspaceTestCaseItem,
} from "@/components/code-workspace/types";
import VoiceTurnCard from "@/components/voice-mode/VoiceTurnCard";
import ProgressBar from "@/components/ProgressBar";
import { patterns } from "@/data/patterns";
import { TestCaseSource } from "@/generated/prisma/client";
import type {
  InterviewPhase,
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import {
  getCodeExecutionUnavailableMessage,
  isCodeExecutionAvailable,
} from "@/lib/code-runner/executor";
import { getRunnerConfig } from "@/lib/code-runner/runnerConfig";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import {
  abandonInterviewAction,
  saveInterviewPhaseAction,
} from "./actions";
import InterviewerSpeechPlayback from "./interviewer-speech-playback";
import InterviewVoiceMode from "./interview-voice-mode";
import InterviewTimer from "./interview-timer";

type InterviewRunnerPageProps = {
  params: Promise<{ interviewId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type InterviewForRunner = NonNullable<
  Awaited<ReturnType<typeof getInterviewForRunner>>
>;
type InterviewRoundForRunner = InterviewForRunner["rounds"][number];
type InterviewMessageForRunner = InterviewForRunner["messages"][number];

type InterviewWorkspaceData = {
  runnerConfigured: boolean;
  initialHistory: WorkspaceSubmissionHistoryItem[];
  initialTestCases: WorkspaceTestCaseItem[];
  initialDebugInsight: DebugInsightView | null;
};

const phaseOrder: InterviewPhase[] = [
  "Setup",
  "ClarifyingQuestions",
  "PatternHypothesis",
  "Approach",
  "Implementation",
  "Testing",
  "Complexity",
  "Feedback",
];

const difficultyStyles = {
  Easy: "border-teal-200 bg-teal-50 text-teal-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Hard: "border-rose-200 bg-rose-50 text-rose-700",
};

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

function formatInterviewType(interviewType: InterviewType): string {
  switch (interviewType) {
    case "SingleProblem":
      return "Single Problem";
    case "FocusedPattern":
      return "Focused Pattern";
    case "MixedInterview":
      return "Mixed Interview";
    case "WeaknessRepair":
      return "Weakness Repair";
  }
}

function formatPhase(phase: InterviewPhase): string {
  switch (phase) {
    case "ClarifyingQuestions":
      return "Clarifying Questions";
    case "PatternHypothesis":
      return "Pattern Hypothesis";
    default:
      return phase.replace(/([A-Z])/g, " $1").trim();
  }
}

function formatResult(result: InterviewResult | null): string {
  switch (result) {
    case "StrongHire":
      return "Strong Hire";
    case "Hire":
      return "Hire";
    case "LeanHire":
      return "Lean Hire";
    case "LeanNoHire":
      return "Lean No Hire";
    case "NoHire":
      return "No Hire";
    default:
      return "No result";
  }
}

function formatRubricCategory(category: RubricCategory): string {
  switch (category) {
    case "PatternRecognition":
      return "Pattern Recognition";
    case "ProblemSolving":
      return "Problem Solving";
    case "TimeManagement":
      return "Time Management";
    default:
      return category;
  }
}

function getCurrentPhase(
  interview: InterviewForRunner,
  currentRound: InterviewRoundForRunner | null,
): InterviewPhase {
  if (interview.status === "Completed") {
    return "Feedback";
  }

  if (!currentRound) {
    return "Feedback";
  }

  if (!currentRound.messages.some((message) => message.phase === "Setup")) {
    return "Setup";
  }

  if (
    !currentRound.messages.some(
      (message) => message.phase === "ClarifyingQuestions" && message.role === "User",
    )
  ) {
    return "ClarifyingQuestions";
  }

  if (!currentRound.selectedPatternId || !currentRound.patternExplanation) {
    return "PatternHypothesis";
  }

  if (!currentRound.approachText) {
    return "Approach";
  }

  if (!currentRound.codeText) {
    return "Implementation";
  }

  if (!currentRound.testCasesText) {
    return "Testing";
  }

  if (!currentRound.complexityText) {
    return "Complexity";
  }

  return "Feedback";
}

function getPhaseInstructions(phase: InterviewPhase): string {
  switch (phase) {
    case "Setup":
      return "Open the problem externally and get oriented. PatternForge shows only seeded metadata here and does not reveal the pattern.";
    case "ClarifyingQuestions":
      return "Write the assumptions, constraints, and clarifying questions you would say out loud to an interviewer.";
    case "PatternHypothesis":
      return "Select the likely pattern and explain the signal. The correct pattern is not shown before you submit.";
    case "Approach":
      return "Describe the high-level plan, data structures, and invariant before implementation.";
    case "Implementation":
      return "Write code in the workspace or paste implementation notes. Running custom self-tests is optional.";
    case "Testing":
      return "Run custom tests if useful, then explain cases, failures, and any fixes you made.";
    case "Complexity":
      return "State time and space complexity and tie them to the operations in your approach.";
    case "Feedback":
      return "Review the saved interviewer feedback, rubric scores, and follow-up recommendations.";
  }
}

function getCurrentRound(interview: InterviewForRunner) {
  return (
    interview.rounds.find((round) => round.status === "Active") ??
    interview.rounds.find((round) => !round.completedAt) ??
    interview.rounds.at(-1) ??
    null
  );
}

function getRoundProgress(interview: InterviewForRunner) {
  const completedRounds = interview.rounds.filter(
    (round) => round.status === "Completed" || round.status === "Skipped",
  ).length;

  return {
    completedRounds,
    totalRounds: interview.rounds.length,
    progress:
      interview.rounds.length === 0
        ? 0
        : Math.round((completedRounds / interview.rounds.length) * 100),
  };
}

function getInitialSecondsRemaining(interview: InterviewForRunner) {
  const elapsedSeconds = Math.floor(
    (Date.now() - interview.startedAt.getTime()) / 1000,
  );

  return interview.durationMinutes * 60 - elapsedSeconds;
}

function shouldShowWorkspace(phase: InterviewPhase): boolean {
  return phase === "Implementation" || phase === "Testing";
}

function getVoiceTargetFieldName(phase: InterviewPhase): string | null {
  switch (phase) {
    case "ClarifyingQuestions":
      return "clarifyingQuestions";
    case "PatternHypothesis":
      return "patternExplanation";
    case "Approach":
      return "approachText";
    case "Implementation":
      return "codeText";
    case "Testing":
      return "testCasesText";
    case "Complexity":
      return "complexityText";
    case "Setup":
    case "Feedback":
      return null;
  }
}

async function getInterviewForRunner(
  interviewId: string,
  userProfileId: string,
) {
  return getPrisma().interviewSession.findFirst({
    where: {
      id: interviewId,
      userProfileId,
    },
    include: {
      targetPattern: true,
      rounds: {
        include: {
          selectedPattern: true,
          correctPattern: true,
          problem: true,
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
          feedbackRecords: {
            orderBy: {
              createdAt: "desc",
            },
          },
          voiceTurns: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
        orderBy: {
          roundNumber: "asc",
        },
      },
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
      feedbackRecords: {
        orderBy: {
          createdAt: "desc",
        },
      },
      rubricScores: {
        orderBy: {
          category: "asc",
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

async function getInterviewSubmissionHistory({
  userProfileId,
  problemId,
  interviewRoundId,
}: {
  userProfileId: string;
  problemId: string;
  interviewRoundId: string;
}): Promise<WorkspaceSubmissionHistoryItem[]> {
  try {
    const submissions = await getPrisma().codeSubmission.findMany({
      where: {
        userProfileId,
        problemId,
        interviewRoundId,
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

async function getInterviewTestCases({
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

async function getLatestInterviewDebugInsight({
  userProfileId,
  problemId,
  interviewRoundId,
}: {
  userProfileId: string;
  problemId: string;
  interviewRoundId: string;
}): Promise<DebugInsightView | null> {
  try {
    const insight = await getPrisma().debugInsight.findFirst({
      where: {
        userProfileId,
        interviewRoundId,
        codeRun: {
          codeSubmission: {
            problemId,
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

async function getInterviewWorkspaceData({
  userProfileId,
  problemId,
  interviewRoundId,
}: {
  userProfileId: string;
  problemId: string;
  interviewRoundId: string;
}): Promise<InterviewWorkspaceData> {
  const [runnerConfig, initialHistory, initialTestCases, initialDebugInsight] =
    await Promise.all([
      getRunnerConfigSafely(problemId),
      getInterviewSubmissionHistory({
        userProfileId,
        problemId,
        interviewRoundId,
      }),
      getInterviewTestCases({
        userProfileId,
        problemId,
      }),
      getLatestInterviewDebugInsight({
        userProfileId,
        problemId,
        interviewRoundId,
      }),
    ]);

  return {
    runnerConfigured: Boolean(runnerConfig),
    initialHistory,
    initialTestCases,
    initialDebugInsight,
  };
}

export default async function InterviewRunnerPage({
  params,
  searchParams,
}: InterviewRunnerPageProps) {
  const [{ interviewId }, resolvedSearchParams, userProfile] = await Promise.all([
    params,
    searchParams,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return <UnauthenticatedInterviewPage />;
  }

  if (!getFeatureFlag("interviews")) {
    return (
      <FeatureUnavailable
        eyebrow="Interview Mode"
        title="Interview Mode is unavailable"
        description="This interview route is turned off for this beta environment. Navigation remains available, but interview sessions cannot be run right now."
        href="/interviews"
        actionLabel="Back to Interviews"
      />
    );
  }

  const interview = await getInterviewForRunner(interviewId, userProfile.id);

  if (!interview) {
    notFound();
  }

  if (interview.status === "Abandoned") {
    return <AbandonedInterviewPage interview={interview} />;
  }

  if (interview.status === "Completed") {
    redirect(`/interviews/${interview.id}/summary`);
  }

  const currentRound = getCurrentRound(interview);
  const currentPhase = getCurrentPhase(interview, currentRound);
  const roundProgress = getRoundProgress(interview);
  const error = getSingleSearchParam(resolvedSearchParams, "error");
  const codeRunnerEnabled =
    getFeatureFlag("codeRunner") && isCodeExecutionAvailable();
  const codeRunnerUnavailableMessage =
    getFeatureFlag("codeRunner")
      ? getCodeExecutionUnavailableMessage()
      : "Code execution is temporarily unavailable.";
  const aiCoachEnabled = getFeatureFlag("aiCoach");
  const voiceModeEnabled = getFeatureFlag("voiceMode");
  const workspaceData =
    currentRound && shouldShowWorkspace(currentPhase)
      ? await getInterviewWorkspaceData({
          userProfileId: userProfile.id,
          problemId: currentRound.problemId,
          interviewRoundId: currentRound.id,
        })
      : null;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
                {formatInterviewType(interview.interviewType)}
              </p>
              <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
                {interview.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-slate-600">
                Current phase: {formatPhase(currentPhase)}
              </p>
            </div>
            {interview.status === "Active" ? (
              <form action={abandonInterviewAction}>
                <input type="hidden" name="interviewId" value={interview.id} />
                <button className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50">
                  Abandon interview
                </button>
              </form>
            ) : null}
          </div>
          <div className="mt-6">
            <ProgressBar
              value={roundProgress.progress}
              label={`Round progress ${roundProgress.completedRounds}/${roundProgress.totalRounds}`}
              tone="indigo"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <InterviewTimer
            startedAt={interview.startedAt.toISOString()}
            durationMinutes={interview.durationMinutes}
            initialSecondsRemaining={getInitialSecondsRemaining(interview)}
            isRunning={interview.status === "Active"}
          />
          <InterviewStatusPanel
            interview={interview}
            currentRound={currentRound}
            currentPhase={currentPhase}
          />
        </div>
      </section>

      {error === "save" || error === "rate" ? (
        <p className="mt-5 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
          {error === "rate"
            ? "Daily AI interview limit reached. Try again later."
            : "Could not save that phase. Check the required fields and try again."}
        </p>
      ) : null}

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <RoundList
          rounds={interview.rounds}
          currentRoundId={currentRound?.id ?? null}
        />
        <div className="space-y-5">
          {currentRound ? (
            <ProblemPanel round={currentRound} currentPhase={currentPhase} />
          ) : null}
          <PhaseRail currentPhase={currentPhase} />
          <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
            <AIInterviewerPanel
              phase={currentPhase}
              messages={interview.messages}
            />
            <PhaseInputPanel
              interview={interview}
              currentRound={currentRound}
              currentPhase={currentPhase}
              voiceModeEnabled={voiceModeEnabled}
            />
          </div>
          {currentRound && workspaceData ? (
            <InterviewCodeWorkspacePanel
              interviewId={interview.id}
              round={currentRound}
              currentPhase={currentPhase}
              workspaceData={workspaceData}
              codeRunnerEnabled={codeRunnerEnabled}
              codeRunnerUnavailableMessage={codeRunnerUnavailableMessage ?? undefined}
              aiCoachEnabled={aiCoachEnabled}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}

function InterviewStatusPanel({
  interview,
  currentRound,
  currentPhase,
}: {
  interview: InterviewForRunner;
  currentRound: InterviewRoundForRunner | null;
  currentPhase: InterviewPhase;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-950 p-4 text-white shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
        Interview status
      </p>
      <p className="mt-2 text-3xl font-black">{interview.status}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Round
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {currentRound
              ? `${currentRound.roundNumber}/${interview.rounds.length}`
              : `${interview.rounds.length}/${interview.rounds.length}`}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-3">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
            Phase
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {formatPhase(currentPhase)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProblemPanel({
  round,
  currentPhase,
}: {
  round: InterviewRoundForRunner;
  currentPhase: InterviewPhase;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Problem
          </p>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {round.problem.title}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            Estimated time: {round.problem.estimatedMinutes} min
          </p>
        </div>
        <span
          className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${difficultyStyles[round.problem.difficulty]}`}
        >
          {round.problem.difficulty}
        </span>
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href={round.problem.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          Open Problem on LeetCode
        </a>
        {currentPhase !== "Feedback" ? (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-3 text-center text-sm font-black text-slate-600">
            Pattern hidden
          </span>
        ) : (
          <span className="rounded-lg border border-teal-200 bg-teal-50 px-5 py-3 text-center text-sm font-black text-teal-700">
            Correct pattern: {round.correctPattern.name}
          </span>
        )}
      </div>
    </section>
  );
}

function PhaseRail({ currentPhase }: { currentPhase: InterviewPhase }) {
  const currentPhaseIndex = phaseOrder.indexOf(currentPhase);

  return (
    <div className="grid gap-2 sm:grid-cols-4 xl:grid-cols-8">
      {phaseOrder.map((phase, index) => {
        const isCurrent = phase === currentPhase;
        const isComplete = index < currentPhaseIndex;

        return (
          <div
            key={phase}
            className={`rounded-lg border p-3 ${
              isCurrent
                ? "border-slate-950 bg-slate-950 text-white"
                : isComplete
                  ? "border-teal-200 bg-teal-50 text-teal-800"
                  : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-[0.14em]">
              0{index + 1}
            </p>
            <p className="mt-1 text-xs font-black">{formatPhase(phase)}</p>
          </div>
        );
      })}
    </div>
  );
}

function RoundList({
  rounds,
  currentRoundId,
}: {
  rounds: InterviewRoundForRunner[];
  currentRoundId: string | null;
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Interview rounds
      </p>
      <div className="mt-5 space-y-3">
        {rounds.map((round) => {
          const isCurrent = round.id === currentRoundId;
          const isComplete = round.status === "Completed";

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
                    {round.problem.title}
                  </p>
                  <p className="mt-1 text-xs font-semibold opacity-80">
                    {round.problem.difficulty} · {round.problem.estimatedMinutes}{" "}
                    min
                  </p>
                </div>
                <span className="rounded-md border border-current px-2 py-1 text-[0.68rem] font-black uppercase tracking-[0.12em] opacity-80">
                  {isComplete ? "Done" : isCurrent ? "Live" : round.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function AIInterviewerPanel({
  phase,
  messages,
}: {
  phase: InterviewPhase;
  messages: InterviewMessageForRunner[];
}) {
  const phaseInstruction = getPhaseInstructions(phase);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        AI interviewer
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {formatPhase(phase)}
      </h2>
      <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
        {phaseInstruction}
      </p>
      <div className="mt-5">
        <InterviewerSpeechPlayback
          phase={phase}
          phaseInstruction={phaseInstruction}
          messages={messages.map((message) => ({
            id: message.id,
            role: message.role,
            phase: message.phase,
            content: message.content,
          }))}
        />
      </div>
      <div className="mt-5 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
            I will guide each phase and save the conversation as you continue.
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
      </div>
    </section>
  );
}

function MessageBubble({ message }: { message: InterviewMessageForRunner }) {
  const isUser = message.role === "User";

  return (
    <div
      className={`rounded-lg border p-4 ${
        isUser
          ? "border-slate-200 bg-slate-50 text-slate-700"
          : "border-teal-200 bg-teal-50 text-teal-800"
      }`}
    >
      <p className="text-xs font-black uppercase tracking-[0.14em] opacity-70">
        {message.role} · {formatPhase(message.phase)}
      </p>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6">
        {message.content}
      </p>
    </div>
  );
}

function PhaseInputPanel({
  interview,
  currentRound,
  currentPhase,
  voiceModeEnabled,
}: {
  interview: InterviewForRunner;
  currentRound: InterviewRoundForRunner | null;
  currentPhase: InterviewPhase;
  voiceModeEnabled: boolean;
}) {
  if (!currentRound || currentPhase === "Feedback") {
    return <FeedbackPanel interview={interview} />;
  }

  const voiceTargetFieldName = getVoiceTargetFieldName(currentPhase);
  const savedVoiceTurns = currentRound.voiceTurns.filter(
    (turn) => turn.phase === currentPhase,
  );

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        User input area
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {formatPhase(currentPhase)}
      </h2>
      <form action={saveInterviewPhaseAction} className="mt-5 space-y-4">
        <input type="hidden" name="interviewId" value={interview.id} />
        <input type="hidden" name="roundId" value={currentRound.id} />
        <input type="hidden" name="phase" value={currentPhase} />
        <PhaseFields round={currentRound} currentPhase={currentPhase} />
        {voiceTargetFieldName ? (
          <InterviewVoiceMode
            interviewId={interview.id}
            roundId={currentRound.id}
            phase={currentPhase}
            targetFieldName={voiceTargetFieldName}
            isOptional={currentPhase === "Implementation"}
            enabled={voiceModeEnabled}
          />
        ) : null}
        {currentPhase === "Implementation" ? (
          <Link
            href={`/problems/${currentRound.problemId}/workspace?mode=Interview&interviewId=${interview.id}&interviewRoundId=${currentRound.id}`}
            className="inline-flex rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Open full Code Workspace
          </Link>
        ) : null}
        <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
          Continue
        </button>
      </form>
      {savedVoiceTurns.length > 0 ? (
        <div className="mt-6 space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Saved voice turns
          </p>
          {savedVoiceTurns.map((turn) => (
            <VoiceTurnCard
              key={turn.id}
              phase={turn.phase}
              speaker={turn.speaker}
              transcript={turn.transcript}
              durationMs={turn.durationMs}
              createdAt={turn.createdAt}
              audioUrl={turn.audioUrl}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function InterviewCodeWorkspacePanel({
  interviewId,
  round,
  currentPhase,
  workspaceData,
  codeRunnerEnabled,
  codeRunnerUnavailableMessage,
  aiCoachEnabled,
}: {
  interviewId: string;
  round: InterviewRoundForRunner;
  currentPhase: InterviewPhase;
  workspaceData: InterviewWorkspaceData;
  codeRunnerEnabled: boolean;
  codeRunnerUnavailableMessage?: string;
  aiCoachEnabled: boolean;
}) {
  const context: WorkspaceContext = {
    mode: "Interview",
    interviewRoundId: round.id,
    returnHref: `/interviews/${interviewId}`,
    returnLabel: "Back to Interview",
  };

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Code Workspace
        </p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
          {currentPhase === "Testing"
            ? "Run custom tests"
            : "Implement in Python"}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
          Code execution is optional for v0.7. Runs are saved to this interview
          round and used as custom self-test evidence during scoring.
        </p>
      </section>
      <CodeWorkspace
        problem={round.problem}
        context={context}
        runnerConfigured={workspaceData.runnerConfigured}
        codeRunnerEnabled={codeRunnerEnabled}
        codeRunnerUnavailableMessage={codeRunnerUnavailableMessage}
        aiCoachEnabled={aiCoachEnabled}
        initialHistory={workspaceData.initialHistory}
        initialTestCases={workspaceData.initialTestCases}
        initialDebugInsight={workspaceData.initialDebugInsight}
        isAuthenticated
        embedded
      />
    </div>
  );
}

function PhaseFields({
  round,
  currentPhase,
}: {
  round: InterviewRoundForRunner;
  currentPhase: InterviewPhase;
}) {
  switch (currentPhase) {
    case "Setup":
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-600">
          Open the external problem in a new tab. Continue when you are ready to
          speak through clarifying questions.
        </div>
      );
    case "ClarifyingQuestions":
      return (
        <TextAreaField
          name="clarifyingQuestions"
          label="Assumptions and questions"
          placeholder="Example: Can I assume input length fits memory? Are duplicate values allowed?"
        />
      );
    case "PatternHypothesis":
      return (
        <>
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              Likely pattern
            </span>
            <select
              name="selectedPatternId"
              defaultValue={round.selectedPatternId ?? ""}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
            >
              <option value="" disabled>
                Select a pattern
              </option>
              {patterns.map((pattern) => (
                <option key={pattern.id} value={pattern.id}>
                  {pattern.name}
                </option>
              ))}
            </select>
          </label>
          <TextAreaField
            name="patternExplanation"
            label="Why this pattern"
            placeholder="Explain the signal, constraint, and why other common patterns are less likely."
            defaultValue={round.patternExplanation ?? ""}
          />
        </>
      );
    case "Approach":
      return (
        <TextAreaField
          name="approachText"
          label="High-level plan"
          placeholder="Describe the data structures, invariant, and step-by-step strategy."
          defaultValue={round.approachText ?? ""}
        />
      );
    case "Implementation":
      return (
        <TextAreaField
          name="codeText"
          label="Code or implementation notes"
          placeholder="Paste code, summarize what you wrote in the workspace, or record implementation notes."
          defaultValue={round.codeText ?? ""}
          minHeightClass="min-h-72"
        />
      );
    case "Testing":
      return (
        <TextAreaField
          name="testCasesText"
          label="Test cases and edge cases"
          placeholder="List normal cases, edge cases, failed cases you observed, and what you changed after a failed custom run."
          defaultValue={round.testCasesText ?? ""}
        />
      );
    case "Complexity":
      return (
        <>
          <TextAreaField
            name="complexityText"
            label="Time and space complexity"
            placeholder="Example: Time O(n) because each element is processed once; space O(k) for the map."
            defaultValue={round.complexityText ?? ""}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Self-reported result
              </span>
              <select
                name="solvedStatus"
                defaultValue="Partially Solved"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="Solved">Solved</option>
                <option value="Partially Solved">Partially Solved</option>
                <option value="Not Solved">Not Solved</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Time spent
              </span>
              <input
                name="timeSpentMinutes"
                type="number"
                min={1}
                defaultValue={round.problem.estimatedMinutes}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                Confidence
              </span>
              <select
                name="confidence"
                defaultValue="3"
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
              >
                <option value="1">1 - Low</option>
                <option value="2">2</option>
                <option value="3">3 - Medium</option>
                <option value="4">4</option>
                <option value="5">5 - High</option>
              </select>
            </label>
          </div>
        </>
      );
    default:
      return null;
  }
}

function TextAreaField({
  name,
  label,
  placeholder,
  defaultValue = "",
  minHeightClass = "min-h-44",
}: {
  name: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  minHeightClass?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <textarea
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className={`mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-semibold leading-6 text-slate-700 ${minHeightClass}`}
      />
    </label>
  );
}

function FeedbackPanel({ interview }: { interview: InterviewForRunner }) {
  const feedback = interview.feedbackRecords[0];

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Feedback
      </p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">
            {formatResult(interview.result)}
          </h2>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Overall score:{" "}
            {typeof interview.overallScore === "number"
              ? `${interview.overallScore}%`
              : "Pending"}
          </p>
        </div>
        <Link
          href="/interviews"
          className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Back to Interviews
        </Link>
      </div>

      {feedback ? (
        <>
          <div className="mt-5">
            <InterviewerSpeechPlayback
              phase="Feedback"
              feedbackSummary={feedback.summary}
              followUpRecommendations={feedback.followUpRecommendations}
            />
          </div>
          <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
            {feedback.summary}
          </p>
          <FeedbackList title="Strengths" items={feedback.strengths} />
          <FeedbackList title="Weaknesses" items={feedback.weaknesses} />
          <FeedbackList
            title="Follow-up recommendations"
            items={feedback.followUpRecommendations}
          />
        </>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          Feedback will appear after the final complexity phase is saved.
        </p>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {interview.rubricScores.map((rubricScore) => (
          <div
            key={rubricScore.id}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {formatRubricCategory(rubricScore.category)}
            </p>
            <p className="mt-2 text-2xl font-black text-slate-950">
              {rubricScore.score}%
            </p>
            <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">
              {rubricScore.notes}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeedbackList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mt-5">
      <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <p
            key={item}
            className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-700"
          >
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function AbandonedInterviewPage({
  interview,
}: {
  interview: InterviewForRunner;
}) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-700">
          Interview abandoned
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          {interview.title}
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
          This interview is closed. Start a new mock session when you are ready.
        </p>
        <Link
          href="/interviews"
          className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
        >
          Back to Interviews
        </Link>
      </section>
    </main>
  );
}

function UnauthenticatedInterviewPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Interview Mode
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to resume this interview
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Interview progress, messages, and feedback are private to your
          PatternForge account.
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
