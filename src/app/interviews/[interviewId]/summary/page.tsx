import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ProgressBar from "@/components/ProgressBar";
import type {
  CommunicationInsightType,
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import { GameEventType as GameEventTypeEnum } from "@/generated/prisma/enums";
import { buildGameEventKey } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import {
  createFlashcardFromCommunicationInsightAction,
  createMistakeFromCommunicationInsightAction,
} from "./actions";

type InterviewSummaryPageProps = {
  params: Promise<{ interviewId: string }>;
};

type InterviewForSummary = NonNullable<
  Awaited<ReturnType<typeof getInterviewForSummary>>
>;
type RoundForSummary = InterviewForSummary["rounds"][number];
type FeedbackForSummary = InterviewForSummary["feedbackRecords"][number];
type VoiceFeedbackForSummary = InterviewForSummary["voiceFeedbackRecords"][number];
type CommunicationInsightForSummary =
  VoiceFeedbackForSummary["communicationInsights"][number];

const rubricCategories: RubricCategory[] = [
  "Communication",
  "PatternRecognition",
  "ProblemSolving",
  "Implementation",
  "Testing",
  "Complexity",
  "TimeManagement",
];

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

function getResultCopy(result: InterviewResult | null): string {
  switch (result) {
    case "StrongHire":
    case "Hire":
      return "You communicated clearly and recognized the core pattern quickly.";
    case "LeanHire":
      return "Your approach was solid, but testing and complexity explanation need work.";
    case "LeanNoHire":
    case "NoHire":
      return "This interview exposed useful weak spots. Start with the recommended drills.";
    default:
      return "Complete the interview to generate a full summary.";
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

function formatDuration(startedAt: Date, completedAt: Date | null): string {
  if (!completedAt) {
    return "In progress";
  }

  const minutes = Math.max(
    1,
    Math.round((completedAt.getTime() - startedAt.getTime()) / (1000 * 60)),
  );

  return `${minutes} min`;
}

function truncateText(value: string | null | undefined, fallback: string, limit = 220): string {
  const normalized = value?.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return fallback;
  }

  return normalized.length > limit
    ? `${normalized.slice(0, limit).trim()}...`
    : normalized;
}

function formatPhaseLabel(phase: string): string {
  switch (phase) {
    case "ClarifyingQuestions":
      return "Clarifying Questions";
    case "PatternHypothesis":
      return "Pattern Hypothesis";
    default:
      return phase.replace(/([A-Z])/g, " $1").trim();
  }
}

function formatSpokenDuration(durationMs: number | null): string {
  if (!durationMs || durationMs <= 0) {
    return "Not tracked";
  }

  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${seconds.toString().padStart(2, "0")}s`
    : `${seconds}s`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringArrayFromJson(value: unknown, key: string): string[] {
  if (!isRecord(value)) {
    return [];
  }

  const field = value[key];

  if (!Array.isArray(field)) {
    return [];
  }

  return field.filter((item): item is string => typeof item === "string");
}

function getMissedSignals(feedback: FeedbackForSummary | null): string[] {
  return readStringArrayFromJson(feedback?.rubric, "missedSignals");
}

function getPatternExplanationQuality(round: RoundForSummary): string {
  const explanationLength = round.patternExplanation?.trim().length ?? 0;

  if (!round.selectedPatternId) {
    return "No pattern hypothesis saved.";
  }

  if (round.selectedPatternId !== round.correctPatternId) {
    return explanationLength >= 80
      ? "Detailed, but pointed at the wrong pattern."
      : "Wrong pattern and explanation needs more signal.";
  }

  if (explanationLength >= 140) {
    return "Strong pattern explanation with useful signal.";
  }

  if (explanationLength >= 60) {
    return "Correct pattern with a workable explanation.";
  }

  return "Correct pattern, but explanation should be more explicit.";
}

function getRubricImprovement(category: RubricCategory, score: number): string {
  if (score >= 85) {
    return "Keep this strength consistent under time pressure.";
  }

  switch (category) {
    case "Communication":
      return "Use a clearer talk-track: constraints, approach, invariant, tradeoff.";
    case "PatternRecognition":
      return "Name the signal that separates the correct pattern from nearby alternatives.";
    case "ProblemSolving":
      return "State the invariant and why each step preserves it.";
    case "Implementation":
      return "Walk through boundary cases before considering the implementation complete.";
    case "Testing":
      return "Add smallest input, duplicate/empty cases, and one pitfall-targeting case.";
    case "Complexity":
      return "Tie each Big-O term to the loop, recursion, or data structure.";
    case "TimeManagement":
      return "Move from hypothesis to approach faster and reserve time for tests.";
  }
}

function getTotalSpokenDuration(
  voiceTurns: InterviewForSummary["voiceTurns"],
): number | null {
  const durations = voiceTurns
    .map((turn) => turn.durationMs)
    .filter((duration): duration is number => typeof duration === "number");

  if (durations.length === 0) {
    return null;
  }

  return durations.reduce((total, duration) => total + duration, 0);
}

function getEvidenceText(insight: CommunicationInsightForSummary): string {
  const evidence = insight.evidence;

  if (!isRecord(evidence)) {
    return insight.summary;
  }

  const quote = evidence.quote;
  const reason = evidence.reason;

  if (typeof quote === "string" && quote.trim()) {
    return quote.trim();
  }

  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }

  return insight.summary;
}

function getInsightByType(
  insights: CommunicationInsightForSummary[],
  types: CommunicationInsightType[],
): CommunicationInsightForSummary | null {
  return insights.find((insight) => types.includes(insight.insightType)) ?? null;
}

function getBestExplanation(
  voiceTurns: InterviewForSummary["voiceTurns"],
  insights: CommunicationInsightForSummary[],
): string {
  const strongInsight = getInsightByType(insights, [
    "StrongExplanation",
    "GoodTradeoffDiscussion",
  ]);

  if (strongInsight) {
    return getEvidenceText(strongInsight);
  }

  const candidate = voiceTurns
    .filter((turn) => turn.speaker === "User")
    .slice()
    .sort((left, right) => right.transcript.length - left.transcript.length)[0];

  return truncateText(candidate?.transcript, "No strong spoken explanation detected yet.");
}

function getVagueAnswerHighlight(
  insights: CommunicationInsightForSummary[],
): string {
  const vagueInsight = getInsightByType(insights, [
    "UnclearApproach",
    "TooQuietOrUncertain",
  ]);

  return vagueInsight
    ? getEvidenceText(vagueInsight)
    : "No unclear spoken answer was flagged.";
}

function getMissingReasoningHighlight(
  insights: CommunicationInsightForSummary[],
): string {
  const missingInsight = getInsightByType(insights, [
    "MissingInvariant",
    "WeakTestingExplanation",
    "WeakComplexityExplanation",
  ]);

  return missingInsight
    ? getEvidenceText(missingInsight)
    : "No missing invariant, edge-case, or complexity gap was flagged.";
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

function getWeakestRubricCategory(
  rubricScores: InterviewForSummary["rubricScores"],
): RubricCategory | null {
  return (
    rubricScores
      .slice()
      .sort((a, b) => a.score - b.score || a.category.localeCompare(b.category))[0]
      ?.category ?? null
  );
}

async function getInterviewForSummary(
  interviewId: string,
  userProfileId: string,
) {
  return getPrisma().interviewSession.findFirst({
    where: {
      id: interviewId,
      userProfileId,
    },
    select: {
      id: true,
      title: true,
      status: true,
      targetPatternId: true,
      interviewType: true,
      result: true,
      overallScore: true,
      startedAt: true,
      completedAt: true,
      targetPattern: {
        select: {
          id: true,
          name: true,
        },
      },
      rounds: {
        select: {
          id: true,
          roundNumber: true,
          status: true,
          selectedPatternId: true,
          correctPatternId: true,
          patternExplanation: true,
          approachText: true,
          testCasesText: true,
          complexityText: true,
          problem: {
            select: {
              title: true,
              difficulty: true,
              estimatedMinutes: true,
            },
          },
          selectedPattern: {
            select: {
              id: true,
              name: true,
            },
          },
          correctPattern: {
            select: {
              id: true,
              name: true,
            },
          },
          attempt: {
            select: {
              mistakes: {
                select: {
                  id: true,
                  mistakeType: true,
                  description: true,
                  pattern: {
                    select: {
                      name: true,
                    },
                  },
                  problem: {
                    select: {
                      title: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
              flashcards: {
                select: {
                  id: true,
                  front: true,
                  back: true,
                  pattern: {
                    select: {
                      name: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          },
          aiReview: {
            select: {
              feedbackSummary: true,
            },
          },
          feedbackRecords: {
            select: {
              summary: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          roundNumber: "asc",
        },
      },
      feedbackRecords: {
        select: {
          summary: true,
          strengths: true,
          weaknesses: true,
          rubric: true,
          followUpRecommendations: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      },
      rubricScores: {
        select: {
          category: true,
          score: true,
          notes: true,
        },
        orderBy: {
          category: "asc",
        },
      },
      voiceTurns: {
        select: {
          id: true,
          phase: true,
          speaker: true,
          transcript: true,
          durationMs: true,
        },
        where: {
          speaker: "User",
        },
        orderBy: {
          createdAt: "asc",
        },
      },
      voiceFeedbackRecords: {
        select: {
          id: true,
          clarityScore: true,
          structureScore: true,
          concisenessScore: true,
          confidenceScore: true,
          technicalExplanationScore: true,
          summary: true,
          strengths: true,
          weaknesses: true,
          suggestedPractice: true,
          communicationInsights: {
            select: {
              id: true,
              insightType: true,
              severity: true,
              summary: true,
              evidence: true,
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

async function getInterviewXp(userProfileId: string, interviewId: string) {
  const eventKeys = [
    GameEventTypeEnum.InterviewCompleted,
    GameEventTypeEnum.InterviewStrongResult,
    GameEventTypeEnum.InterviewImprovement,
  ].map((eventType) =>
    buildGameEventKey(
      userProfileId,
      eventType,
      { interviewId },
    ),
  );
  const events = await getPrisma().gameEvent.findMany({
    where: {
      userProfileId,
      OR: [
        {
          eventKey: {
            in: eventKeys,
          },
        },
        {
          eventType: GameEventTypeEnum.VoiceInterviewCompleted,
          metadata: {
            path: ["interviewId"],
            equals: interviewId,
          },
        },
      ],
    },
    select: {
      xpAmount: true,
    },
  });

  return events.reduce((total, event) => total + event.xpAmount, 0);
}

export default async function InterviewSummaryPage({
  params,
}: InterviewSummaryPageProps) {
  const [{ interviewId }, userProfile] = await Promise.all([
    params,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return <UnauthenticatedSummaryPage />;
  }

  const interview = await getInterviewForSummary(interviewId, userProfile.id);

  if (!interview) {
    notFound();
  }

  if (interview.status === "Active") {
    redirect(`/interviews/${interview.id}`);
  }

  const feedback = interview.feedbackRecords[0] ?? null;
  const completedRounds = interview.rounds.filter(
    (round) => round.status === "Completed",
  );
  const correctPatternCount = completedRounds.filter(
    (round) => round.selectedPatternId === round.correctPatternId,
  ).length;
  const patternAccuracy =
    completedRounds.length === 0
      ? 0
      : Math.round((correctPatternCount / completedRounds.length) * 100);
  const mistakes = uniqueById(
    interview.rounds.flatMap((round) => round.attempt?.mistakes ?? []),
  );
  const flashcards = uniqueById(
    interview.rounds.flatMap((round) => round.attempt?.flashcards ?? []),
  );
  const missedSignals = getMissedSignals(feedback);
  const voiceFeedback = interview.voiceFeedbackRecords[0] ?? null;
  const communicationInsights = voiceFeedback?.communicationInsights ?? [];
  const spokenTurns = interview.voiceTurns.filter((turn) => turn.speaker === "User");
  const totalSpokenDuration = getTotalSpokenDuration(spokenTurns);
  const weakestCategory = getWeakestRubricCategory(interview.rubricScores);
  const weakestPatternId =
    completedRounds.find((round) => round.selectedPatternId !== round.correctPatternId)
      ?.correctPattern.id ??
    completedRounds[0]?.correctPattern.id ??
    interview.targetPatternId ??
    null;
  const xpEarned = await getInterviewXp(userProfile.id, interview.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
              {formatInterviewType(interview.interviewType)}
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              {interview.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              {getResultCopy(interview.result)}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">
              Result
            </p>
            <p className="mt-1 text-3xl font-black">
              {formatResult(interview.result)}
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard
          label="Overall score"
          value={
            typeof interview.overallScore === "number"
              ? `${interview.overallScore}%`
              : "Pending"
          }
        />
        <StatCard
          label="Duration"
          value={formatDuration(interview.startedAt, interview.completedAt)}
        />
        <StatCard
          label="Problems completed"
          value={`${completedRounds.length}/${interview.rounds.length}`}
        />
        <StatCard
          label="Pattern accuracy"
          value={`${patternAccuracy}%`}
        />
        <StatCard label="XP earned" value={xpEarned > 0 ? `+${xpEarned}` : "0"} />
        <StatCard
          label="Weakest area"
          value={weakestCategory ? formatRubricCategory(weakestCategory) : "No data"}
        />
      </section>

      <section className="mt-8">
        <SectionHeader eyebrow="Rubric" title="Interview scoring breakdown" />
        <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rubricCategories.map((category) => {
            const rubricScore = interview.rubricScores.find(
              (score) => score.category === category,
            );
            const score = rubricScore?.score ?? 0;

            return (
              <RubricCard
                key={category}
                category={category}
                score={score}
                notes={rubricScore?.notes ?? "No notes saved for this category."}
                improvement={getRubricImprovement(category, score)}
              />
            );
          })}
        </div>
      </section>

      <VoiceCommunicationSection
        interviewId={interview.id}
        voiceFeedback={voiceFeedback}
        voiceTurns={spokenTurns}
        totalSpokenDuration={totalSpokenDuration}
        communicationInsights={communicationInsights}
        practicePatternId={weakestPatternId}
      />

      <section className="mt-8">
        <SectionHeader eyebrow="Rounds" title="Round-by-round breakdown" />
        <div className="mt-5 space-y-4">
          {interview.rounds.map((round) => (
            <RoundBreakdownCard key={round.id} round={round} />
          ))}
        </div>
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <ListPanel title="Strengths" items={feedback?.strengths ?? []} />
        <ListPanel title="Weaknesses" items={feedback?.weaknesses ?? []} />
        <ListPanel title="Missed signals" items={missedSignals} />
        <ListPanel
          title="Follow-up recommendations"
          items={feedback?.followUpRecommendations ?? []}
        />
      </section>

      <section className="mt-8 grid gap-5 lg:grid-cols-2">
        <ArtifactPanel
          title="Mistakes created"
          emptyText="No mistake cards were created for this interview."
          items={mistakes.map((mistake) => ({
            id: mistake.id,
            title: mistake.mistakeType,
            body: mistake.description,
            meta: `${mistake.problem.title} · ${mistake.pattern.name}`,
          }))}
        />
        <ArtifactPanel
          title="Flashcards created"
          emptyText="No flashcards were created for this interview."
          items={flashcards.map((flashcard) => ({
            id: flashcard.id,
            title: flashcard.front,
            body: flashcard.back,
            meta: flashcard.pattern.name,
          }))}
        />
      </section>

      <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Next actions
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <ActionLink href="/" label="Back to Dashboard" />
          <ActionLink href="/interviews" label="Start Another Interview" />
          <ActionLink
            href={weakestPatternId ? `/patterns/${weakestPatternId}` : "/forge"}
            label="Practice Weakest Area"
          />
          <ActionLink href="/mistakes" label="Review Mistakes" />
          <ActionLink href="/plans" label="Open Learning Plan" />
        </div>
      </section>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
        {title}
      </h2>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </p>
    </article>
  );
}

function RubricCard({
  category,
  score,
  notes,
  improvement,
}: {
  category: RubricCategory;
  score: number;
  notes: string;
  improvement: string;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-teal-700">
            {formatRubricCategory(category)}
          </p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            {score}%
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
          Rubric
        </span>
      </div>
      <div className="mt-4">
        <ProgressBar value={score} tone={score >= 75 ? "teal" : score >= 55 ? "amber" : "rose"} />
      </div>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
        {notes}
      </p>
      <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-bold leading-6 text-slate-700">
        {improvement}
      </p>
    </article>
  );
}

function VoiceCommunicationSection({
  interviewId,
  voiceFeedback,
  voiceTurns,
  totalSpokenDuration,
  communicationInsights,
  practicePatternId,
}: {
  interviewId: string;
  voiceFeedback: VoiceFeedbackForSummary | null;
  voiceTurns: InterviewForSummary["voiceTurns"];
  totalSpokenDuration: number | null;
  communicationInsights: CommunicationInsightForSummary[];
  practicePatternId: string | null;
}) {
  const voiceModeUsed = voiceTurns.length > 0;
  const artifactInsight =
    communicationInsights.find(
      (insight) =>
        insight.insightType !== "StrongExplanation" &&
        insight.insightType !== "GoodTradeoffDiscussion",
    ) ??
    communicationInsights[0] ??
    null;

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionHeader eyebrow="Voice Mode" title="Voice communication" />
        <span
          className={`rounded-md border px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] ${
            voiceModeUsed
              ? "border-teal-200 bg-teal-50 text-teal-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }`}
        >
          {voiceModeUsed ? "Voice used" : "Voice not used"}
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        <StatCard label="Spoken turns" value={String(voiceTurns.length)} />
        <StatCard
          label="Spoken time"
          value={formatSpokenDuration(totalSpokenDuration)}
        />
        <StatCard
          label="Clarity"
          value={voiceFeedback ? `${voiceFeedback.clarityScore}%` : "No data"}
        />
        <StatCard
          label="Structure"
          value={voiceFeedback ? `${voiceFeedback.structureScore}%` : "No data"}
        />
        <StatCard
          label="Conciseness"
          value={voiceFeedback ? `${voiceFeedback.concisenessScore}%` : "No data"}
        />
        <StatCard
          label="Confidence"
          value={voiceFeedback ? `${voiceFeedback.confidenceScore}%` : "No data"}
        />
        <StatCard
          label="Technical"
          value={
            voiceFeedback
              ? `${voiceFeedback.technicalExplanationScore}%`
              : "No data"
          }
        />
      </div>

      {voiceFeedback ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
          {voiceFeedback.summary}
        </p>
      ) : (
        <p className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
          Voice communication feedback was not generated for this interview.
        </p>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <TranscriptHighlight
          title="Best explanation"
          value={getBestExplanation(voiceTurns, communicationInsights)}
        />
        <TranscriptHighlight
          title="Vague answer"
          value={getVagueAnswerHighlight(communicationInsights)}
        />
        <TranscriptHighlight
          title="Missing reasoning"
          value={getMissingReasoningHighlight(communicationInsights)}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ListPanel
          title="Communication strengths"
          items={voiceFeedback?.strengths ?? []}
        />
        <ListPanel
          title="Communication weaknesses"
          items={voiceFeedback?.weaknesses ?? []}
        />
        <ListPanel
          title="Suggested speaking practice"
          items={voiceFeedback?.suggestedPractice ?? []}
        />
      </div>

      {communicationInsights.length > 0 ? (
        <div className="mt-5">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Communication insights
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {communicationInsights.map((insight) => (
              <article
                key={insight.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                      {insight.insightType}
                    </p>
                    <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
                      {insight.summary}
                    </p>
                  </div>
                  <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                    {insight.severity}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <CommunicationInsightFormButton
                    action={createFlashcardFromCommunicationInsightAction}
                    interviewId={interviewId}
                    insightId={insight.id}
                    label="Create flashcard"
                  />
                  <CommunicationInsightFormButton
                    action={createMistakeFromCommunicationInsightAction}
                    interviewId={interviewId}
                    insightId={insight.id}
                    label="Create mistake"
                  />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <ActionLink
          href={`/interviews/${interviewId}/transcript`}
          label="Review transcript"
        />
        <ActionLink
          href={practicePatternId ? `/patterns/${practicePatternId}` : "/patterns"}
          label="Practice explaining this pattern"
        />
        <ActionLink href="/interviews?voiceMode=1" label="Start another voice interview" />
        {artifactInsight ? (
          <>
            <CommunicationInsightFormButton
              action={createFlashcardFromCommunicationInsightAction}
              interviewId={interviewId}
              insightId={artifactInsight.id}
              label="Create flashcard from missed explanation"
              variant="dark"
            />
            <CommunicationInsightFormButton
              action={createMistakeFromCommunicationInsightAction}
              interviewId={interviewId}
              insightId={artifactInsight.id}
              label="Create mistake from communication insight"
              variant="dark"
            />
          </>
        ) : null}
      </div>

      <div id="voice-transcripts" className="mt-6">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Transcript review
        </p>
        {voiceTurns.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
            No spoken transcript turns were saved for this interview.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {voiceTurns.map((turn) => (
              <article
                key={turn.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                    {formatPhaseLabel(turn.phase)} · {turn.speaker}
                  </p>
                  <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600">
                    {formatSpokenDuration(turn.durationMs)}
                  </span>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">
                  {turn.transcript}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TranscriptHighlight({ title, value }: { title: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {title}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
        {value}
      </p>
    </article>
  );
}

function RoundBreakdownCard({ round }: { round: RoundForSummary }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Round {round.roundNumber}
          </p>
          <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {round.problem.title}
          </h3>
          <p className="mt-2 text-sm font-semibold text-slate-500">
            {round.problem.difficulty} · {round.problem.estimatedMinutes} min
          </p>
        </div>
        <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-black text-slate-600">
          {round.status}
        </span>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <Detail
          label="Selected pattern"
          value={round.selectedPattern?.name ?? "Not selected"}
        />
        <Detail label="Correct pattern" value={round.correctPattern.name} />
        <Detail
          label="Pattern explanation quality"
          value={getPatternExplanationQuality(round)}
        />
        <Detail
          label="Approach summary"
          value={truncateText(round.approachText, "No approach saved.")}
        />
        <Detail
          label="Testing summary"
          value={truncateText(round.testCasesText, "No testing notes saved.")}
        />
        <Detail
          label="Complexity answer"
          value={truncateText(round.complexityText, "No complexity answer saved.")}
        />
      </div>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
          Key feedback
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
          {round.aiReview?.feedbackSummary ??
            round.feedbackRecords[0]?.summary ??
            "No round-specific feedback was saved."}
        </p>
      </div>
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
        {value}
      </p>
    </div>
  );
}

function ListPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          No items saved.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <p
              key={item}
              className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700"
            >
              {item}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

function ArtifactPanel({
  title,
  emptyText,
  items,
}: {
  title: string;
  emptyText: string;
  items: { id: string; title: string; body: string; meta: string }[];
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200 bg-slate-50 p-4"
            >
              <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                {item.meta}
              </p>
              <h3 className="mt-2 text-lg font-black tracking-tight text-slate-950">
                {item.title}
              </h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
    >
      {label}
    </Link>
  );
}

function CommunicationInsightFormButton({
  action,
  interviewId,
  insightId,
  label,
  variant = "light",
}: {
  action: (formData: FormData) => void | Promise<void>;
  interviewId: string;
  insightId: string;
  label: string;
  variant?: "light" | "dark";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="interviewId" value={interviewId} />
      <input type="hidden" name="insightId" value={insightId} />
      <button
        className={
          variant === "dark"
            ? "rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
            : "rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        }
      >
        {label}
      </button>
    </form>
  );
}

function UnauthenticatedSummaryPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Interview Summary
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to view this summary
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Interview results and feedback are private to your PatternForge account.
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
