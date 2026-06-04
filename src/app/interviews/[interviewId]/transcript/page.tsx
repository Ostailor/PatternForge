import { SignInButton } from "@clerk/nextjs";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { InterviewPhase } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import { VOICE_MODE_PRIVACY_COPY } from "@/lib/voice/voicePrivacy";

import { deleteVoiceTranscriptsAction } from "../actions";
import VoiceTranscriptClient from "./transcript-client";

type VoiceTranscriptPageProps = {
  params: Promise<{ interviewId: string }>;
  searchParams: Promise<{
    voiceAction?: string;
    page?: string;
  }>;
};

type TranscriptData = NonNullable<Awaited<ReturnType<typeof getInterviewForTranscript>>>;
type InterviewForTranscript = TranscriptData["interview"];
type TranscriptMessage = InterviewForTranscript["messages"][number];
type TranscriptVoiceTurn = InterviewForTranscript["voiceTurns"][number];
type TranscriptInsight =
  InterviewForTranscript["voiceFeedbackRecords"][number]["communicationInsights"][number];

const TRANSCRIPT_PAGE_SIZE = 40;

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

function getPhaseIndex(phase: InterviewPhase): number {
  const index = phaseOrder.indexOf(phase);

  return index === -1 ? phaseOrder.length : index;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeEvidence(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function parsePage(value: string | undefined): number {
  const page = Number.parseInt(value ?? "", 10);

  return Number.isFinite(page) && page > 0 ? page : 1;
}

async function getInterviewForTranscript(
  interviewId: string,
  userProfileId: string,
  page: number,
) {
  const prisma = getPrisma();
  const interview = await prisma.interviewSession.findFirst({
    where: {
      id: interviewId,
      userProfileId,
    },
    select: {
      id: true,
      title: true,
      voiceFeedbackRecords: {
        include: {
          communicationInsights: {
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

  if (!interview) {
    return null;
  }

  const [messageRefs, voiceTurnRefs, totalVoiceTurns, interviewerMessageCount] =
    await Promise.all([
      prisma.interviewMessage.findMany({
        where: {
          interviewSessionId: interview.id,
          role: {
            not: "User",
          },
        },
        select: {
          id: true,
          phase: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.voiceTurn.findMany({
        where: {
          interviewSessionId: interview.id,
          speaker: "User",
        },
        select: {
          id: true,
          phase: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.voiceTurn.count({
        where: {
          interviewSessionId: interview.id,
          speaker: "User",
        },
      }),
      prisma.interviewMessage.count({
        where: {
          interviewSessionId: interview.id,
          role: "Interviewer",
        },
      }),
    ]);
  const turnRefs = [
    ...messageRefs.map((message) => ({
      id: message.id,
      source: "message" as const,
      phase: message.phase,
      createdAt: message.createdAt,
    })),
    ...voiceTurnRefs.map((turn) => ({
      id: turn.id,
      source: "voice" as const,
      phase: turn.phase,
      createdAt: turn.createdAt,
    })),
  ].sort((left, right) => {
    const timeDelta = left.createdAt.getTime() - right.createdAt.getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return getPhaseIndex(left.phase) - getPhaseIndex(right.phase);
  });
  const pageRefs = turnRefs.slice(
    (page - 1) * TRANSCRIPT_PAGE_SIZE,
    page * TRANSCRIPT_PAGE_SIZE,
  );
  const messageIds = new Set(
    pageRefs
      .filter((ref) => ref.source === "message")
      .map((ref) => ref.id),
  );
  const voiceTurnIds = new Set(
    pageRefs
      .filter((ref) => ref.source === "voice")
      .map((ref) => ref.id),
  );
  const [messages, voiceTurns] = await Promise.all([
    messageIds.size > 0
      ? prisma.interviewMessage.findMany({
          where: {
            id: {
              in: Array.from(messageIds),
            },
          },
          include: {
            interviewRound: {
              include: {
                problem: true,
              },
            },
          },
        })
      : [],
    voiceTurnIds.size > 0
      ? prisma.voiceTurn.findMany({
          where: {
            id: {
              in: Array.from(voiceTurnIds),
            },
          },
          include: {
            interviewRound: {
              include: {
                problem: true,
              },
            },
          },
        })
      : [],
  ]);
  const messageOrder = new Map(pageRefs.map((ref, index) => [ref.id, index]));

  return {
    interview: {
      ...interview,
      messages: messages.sort(
        (left, right) =>
          (messageOrder.get(left.id) ?? 0) - (messageOrder.get(right.id) ?? 0),
      ),
      voiceTurns: voiceTurns.sort(
        (left, right) =>
          (messageOrder.get(left.id) ?? 0) - (messageOrder.get(right.id) ?? 0),
      ),
    },
    totalTranscriptTurns: turnRefs.length,
    totalVoiceTurns,
    interviewerMessageCount,
  };
}

function toMessageTurn(message: TranscriptMessage) {
  return {
    id: `message:${message.id}`,
    source: "message" as const,
    role: message.role,
    phase: message.phase,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    roundNumber: message.interviewRound?.roundNumber ?? null,
    problemTitle: message.interviewRound?.problem.title ?? null,
    durationMs: null,
  };
}

function toVoiceTurn(turn: TranscriptVoiceTurn) {
  return {
    id: `voice:${turn.id}`,
    source: "voice" as const,
    role: turn.speaker,
    phase: turn.phase,
    content: turn.transcript,
    createdAt: turn.createdAt.toISOString(),
    roundNumber: turn.interviewRound?.roundNumber ?? null,
    problemTitle: turn.interviewRound?.problem.title ?? null,
    durationMs: turn.durationMs,
  };
}

function getTranscriptTurns(interview: InterviewForTranscript) {
  return [
    ...interview.messages
      .filter((message) => message.role !== "User")
      .map(toMessageTurn),
    ...interview.voiceTurns
      .filter((turn) => turn.speaker === "User")
      .map(toVoiceTurn),
  ].sort((left, right) => {
    const timeDelta =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

    if (timeDelta !== 0) {
      return timeDelta;
    }

    return getPhaseIndex(left.phase) - getPhaseIndex(right.phase);
  });
}

function getInsights(interview: InterviewForTranscript) {
  return interview.voiceFeedbackRecords.flatMap((feedback) =>
    feedback.communicationInsights.map((insight: TranscriptInsight) => ({
      id: insight.id,
      insightType: insight.insightType,
      severity: insight.severity,
      summary: insight.summary,
      evidence: normalizeEvidence(insight.evidence),
    })),
  );
}

function getPhaseCounts(turns: ReturnType<typeof getTranscriptTurns>) {
  return phaseOrder
    .map((phase) => ({
      phase,
      count: turns.filter((turn) => turn.phase === phase).length,
    }))
    .filter((item) => item.count > 0);
}

export default async function VoiceTranscriptPage({
  params,
  searchParams,
}: VoiceTranscriptPageProps) {
  const [{ interviewId }, { voiceAction, page: pageValue }, userProfile] = await Promise.all([
    params,
    searchParams,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return <UnauthenticatedTranscriptPage />;
  }

  const page = parsePage(pageValue);
  const transcriptData = await getInterviewForTranscript(
    interviewId,
    userProfile.id,
    page,
  );

  if (!transcriptData) {
    notFound();
  }

  const { interview } = transcriptData;
  const transcriptTurns = getTranscriptTurns(interview);
  const insights = getInsights(interview);
  const phaseCounts = getPhaseCounts(transcriptTurns);
  const pageCount = Math.max(
    1,
    Math.ceil(transcriptData.totalTranscriptTurns / TRANSCRIPT_PAGE_SIZE),
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
              Voice Transcript History
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
              {interview.title}
            </h1>
            <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
              Private transcript history for interviewer prompts and your saved
              Voice Mode turns. Transcripts are not public and are not used for
              social features.
            </p>
            <p className="mt-4 max-w-3xl rounded-lg border border-white/10 bg-white/5 p-3 text-sm font-bold leading-6 text-slate-200">
              {VOICE_MODE_PRIVACY_COPY}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/interviews/${interview.id}/summary`}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:bg-white/10"
            >
              Back to summary
            </Link>
            <Link
              href={`/interviews/${interview.id}`}
              className="rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-teal-100"
            >
              Interview page
            </Link>
          </div>
        </div>
      </section>

      {transcriptData.totalVoiceTurns === 0 ? (
        <section className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold leading-6 text-slate-600">
            {voiceAction === "deleted"
              ? "Voice transcripts were deleted for this interview."
              : "No voice transcript was recorded for this interview."}
          </p>
        </section>
      ) : (
        <>
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  Privacy controls
                </p>
                <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-600">
                  Delete saved voice transcripts and transcript-derived
                  communication feedback for this interview. This does not
                  delete normal interview messages or technical feedback.
                </p>
              </div>
              <form action={deleteVoiceTranscriptsAction}>
                <input type="hidden" name="interviewId" value={interview.id} />
                <button className="rounded-lg border border-rose-200 bg-white px-4 py-3 text-sm font-black text-rose-700 transition hover:bg-rose-50">
                  Delete voice transcripts
                </button>
              </form>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Voice turns"
              value={String(transcriptData.totalVoiceTurns)}
            />
            <StatCard
              label="Transcript turns"
              value={String(transcriptData.totalTranscriptTurns)}
            />
            <StatCard
              label="Interviewer messages"
              value={String(transcriptData.interviewerMessageCount)}
            />
            <StatCard
              label="Feedback insights"
              value={String(insights.length)}
            />
          </section>

          {phaseCounts.length > 0 ? (
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                Phases on this page
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {phaseCounts.map((item) => (
                  <span
                    key={item.phase}
                    className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-600"
                  >
                    {formatPhase(item.phase)} · {item.count}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <VoiceTranscriptClient turns={transcriptTurns} insights={insights} />
            {pageCount > 1 ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-600">
                  Page {page} of {pageCount}
                </p>
                <div className="flex gap-2">
                  {page > 1 ? (
                    <Link
                      href={`/interviews/${interview.id}/transcript?page=${page - 1}`}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Previous
                    </Link>
                  ) : null}
                  {page < pageCount ? (
                    <Link
                      href={`/interviews/${interview.id}/transcript?page=${page + 1}`}
                      className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-black text-white transition hover:bg-teal-700"
                    >
                      Next
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}
    </main>
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

function UnauthenticatedTranscriptPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Voice Transcript History
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to view transcripts
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Voice transcripts are private to your PatternForge account.
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
