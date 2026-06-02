import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import ProgressBar from "@/components/ProgressBar";
import type {
  InterviewResult,
  InterviewType,
  RubricCategory,
} from "@/generated/prisma/enums";
import { GameEventType as GameEventTypeEnum } from "@/generated/prisma/enums";
import { buildGameEventKey } from "@/lib/game/events";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

type InterviewSummaryPageProps = {
  params: Promise<{ interviewId: string }>;
};

type InterviewForSummary = NonNullable<
  Awaited<ReturnType<typeof getInterviewForSummary>>
>;
type RoundForSummary = InterviewForSummary["rounds"][number];
type FeedbackForSummary = InterviewForSummary["feedbackRecords"][number];

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
    include: {
      targetPattern: true,
      rounds: {
        include: {
          problem: true,
          selectedPattern: true,
          correctPattern: true,
          attempt: {
            include: {
              mistakes: {
                include: {
                  pattern: true,
                  problem: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
              flashcards: {
                include: {
                  pattern: true,
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          },
          aiReview: true,
          feedbackRecords: {
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
      eventKey: {
        in: eventKeys,
      },
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
