import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import {
  DiagnosticQuestionType,
  DiagnosticStatus,
} from "@/generated/prisma/enums";
import { getPatternById } from "@/data/patterns";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function formatLevel(level: string | null): string {
  switch (level) {
    case "SomeExperience":
      return "Some Experience";
    case "InterviewPrep":
      return "Interview Prep";
    case "Advanced":
      return "Advanced";
    case "Beginner":
    default:
      return "Beginner";
  }
}

function parseKnownPatternIds(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function getSignals(
  questions: Array<{
    questionType: string;
    selectedAnswer: string | null;
    correctAnswer: string | null;
    wasCorrect: boolean | null;
    confidence: number | null;
  }>,
) {
  const recognitionQuestions = questions.filter(
    (question) =>
      question.questionType === DiagnosticQuestionType.PatternRecognition,
  );
  const correctCount = recognitionQuestions.filter(
    (question) => question.wasCorrect,
  ).length;
  const confidence =
    questions.find(
      (question) =>
        question.questionType === DiagnosticQuestionType.ConfidenceCheck,
    )?.confidence ?? null;
  const knownPatternIds = parseKnownPatternIds(
    questions.find(
      (question) =>
        question.questionType === DiagnosticQuestionType.ExperienceQuestion,
    )?.selectedAnswer ?? null,
  );
  const missedPatternNames = recognitionQuestions
    .filter((question) => question.wasCorrect === false)
    .map((question) => getPatternById(question.correctAnswer ?? "")?.name)
    .filter((name): name is string => Boolean(name));

  const strongestSignal =
    correctCount >= 4
      ? `Pattern recognition: ${correctCount}/${recognitionQuestions.length} correct`
      : knownPatternIds.length > 0
        ? `Known patterns: ${knownPatternIds
            .slice(0, 3)
            .map((patternId) => getPatternById(patternId)?.name)
            .filter(Boolean)
            .join(", ")}`
        : `Confidence baseline: ${confidence ?? 3}/5`;

  const weakestSignal =
    missedPatternNames.length > 0
      ? `Review ${missedPatternNames[0]} recognition first`
      : confidence !== null && confidence < 4
        ? "Confidence is the main growth area"
        : "No major weak signal in this lightweight check";

  return { strongestSignal, weakestSignal };
}

export default async function DiagnosticResultPage({
  searchParams,
}: {
  searchParams: Promise<{ assessmentId?: string }>;
}) {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    return <UnauthenticatedResultPage />;
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedResultPage />;
  }

  const { assessmentId } = await searchParams;
  const assessment = await getPrisma().diagnosticAssessment.findFirst({
    where: {
      userProfileId: userProfile.id,
      status: DiagnosticStatus.Completed,
      ...(assessmentId ? { id: assessmentId } : {}),
    },
    include: {
      questions: {
        select: {
          questionType: true,
          selectedAnswer: true,
          correctAnswer: true,
          wasCorrect: true,
          confidence: true,
        },
        orderBy: { createdAt: "asc" },
      },
      recommendedStartPattern: {
        select: {
          id: true,
          name: true,
          description: true,
        },
      },
      recommendedPlan: {
        include: {
          steps: {
            select: {
              title: true,
              stepType: true,
              targetPattern: { select: { name: true } },
              problem: { select: { title: true } },
            },
            orderBy: [{ dayIndex: "asc" }, { createdAt: "asc" }],
            take: 1,
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
  });

  if (!assessment) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Diagnostic result
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            No completed diagnostic yet
          </h1>
          <Link
            href="/onboarding/diagnostic"
            className="mt-6 inline-flex rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Take Diagnostic
          </Link>
        </section>
      </main>
    );
  }

  const { strongestSignal, weakestSignal } = getSignals(assessment.questions);
  const firstStep = assessment.recommendedPlan?.steps[0] ?? null;
  const firstSession = firstStep
    ? `${firstStep.title}${
        firstStep.problem?.title ? `: ${firstStep.problem.title}` : ""
      }`
    : "Start Daily Forge with your recommended pattern";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Diagnostic result
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Estimated level: {formatLevel(assessment.overallLevel)}
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          This is a lightweight v0.9 estimate from recognition, confidence, and
          pattern familiarity signals.
        </p>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <ResultCard label="Strongest signal" value={strongestSignal} />
        <ResultCard label="Weakest signal" value={weakestSignal} />
        <ResultCard
          label="Recommended starting pattern"
          value={assessment.recommendedStartPattern?.name ?? "Arrays & Hashing"}
          detail={assessment.recommendedStartPattern?.description ?? null}
        />
        <ResultCard
          label="Recommended first session"
          value={firstSession}
          detail={assessment.recommendedPlan?.title ?? null}
        />
      </section>

      <section className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
        <Link
          href="/forge"
          className="rounded-lg bg-slate-950 px-5 py-3 text-center text-sm font-black text-white transition hover:bg-teal-700"
        >
          Start Daily Forge
        </Link>
        <Link
          href={
            assessment.recommendedPlanId
              ? `/plans/${assessment.recommendedPlanId}`
              : "/plans"
          }
          className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-center text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
        >
          View Learning Plan
        </Link>
      </section>
    </main>
  );
}

function ResultCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string | null;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        {label}
      </p>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
        {value}
      </h2>
      {detail ? (
        <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
          {detail}
        </p>
      ) : null}
    </article>
  );
}

function UnauthenticatedResultPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Diagnostic result
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to view your diagnostic result
        </h1>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
