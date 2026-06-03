import { SignInButton } from "@clerk/nextjs";

import { patterns } from "@/data/patterns";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

import SpeakingDrillClient from "./speaking-drill-client";
import type { SpeakingDrillPrompt, SpeakingDrillType } from "./types";

type SpeakingDrillPageProps = {
  searchParams: Promise<{
    type?: string;
    patternId?: string;
  }>;
};

const drillTypes: SpeakingDrillType[] = [
  "pattern",
  "approach",
  "debugging",
  "complexity",
];

function normalizeDrillType(value: string | undefined): SpeakingDrillType {
  return drillTypes.includes(value as SpeakingDrillType)
    ? (value as SpeakingDrillType)
    : "pattern";
}

function truncate(value: string | null | undefined, maxLength = 260): string {
  const text = value?.trim() ?? "";

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}...`;
}

function getSelectedPattern(patternId: string | undefined) {
  return (
    patterns.find((pattern) => pattern.id === patternId) ??
    patterns.slice().sort((left, right) => left.levelOrder - right.levelOrder)[0]
  );
}

function buildPatternPrompt(patternId: string | undefined): SpeakingDrillPrompt {
  const pattern = getSelectedPattern(patternId);

  return {
    id: `pattern:${pattern.id}`,
    drillType: "pattern",
    phase: "PatternHypothesis",
    title: `Explain ${pattern.name}`,
    eyebrow: "Explain a Pattern",
    description:
      "Explain when to use this pattern, what clues point to it, the template shape, and common mistakes.",
    contextTitle: pattern.name,
    contextItems: [
      { label: "Category", value: pattern.category },
      { label: "Pattern", value: pattern.description },
      { label: "Template", value: pattern.templateSummary },
      { label: "Clues", value: pattern.recognitionClues.join("; ") },
      { label: "Mistakes", value: pattern.commonMistakes.join("; ") },
    ],
    focusChecklist: [
      "State when the pattern applies.",
      "Name two recognition clues.",
      "Describe the invariant or maintained state.",
      "Mention one template step and one common mistake.",
    ],
    patternId: pattern.id,
    isAvailable: true,
  };
}

async function buildApproachPrompt(): Promise<SpeakingDrillPrompt> {
  const problem = await getPrisma().problem.findFirst({
    select: {
      id: true,
      title: true,
      difficulty: true,
      estimatedMinutes: true,
      recognitionClues: true,
      commonMistakes: true,
      problemPatterns: {
        select: {
          isPrimary: true,
          pattern: {
            select: {
              id: true,
              name: true,
              templateSummary: true,
            },
          },
        },
        orderBy: { isPrimary: "desc" },
      },
    },
    orderBy: [{ difficulty: "asc" }, { title: "asc" }],
  });

  if (!problem) {
    return {
      id: "approach:unavailable",
      drillType: "approach",
      phase: "Approach",
      title: "Explain an approach",
      eyebrow: "Explain an Approach",
      description: "Explain the high-level algorithm before coding.",
      contextTitle: "No problem metadata available",
      contextItems: [],
      focusChecklist: [],
      isAvailable: false,
      unavailableReason:
        "Add PatternForge problems before running approach speaking drills.",
    };
  }

  const primaryPattern = problem.problemPatterns[0]?.pattern ?? null;

  return {
    id: `approach:${problem.id}`,
    drillType: "approach",
    phase: "Approach",
    title: `Explain an approach for ${problem.title}`,
    eyebrow: "Explain an Approach",
    description:
      "Explain the algorithm without coding. Do not reveal or rely on external problem statements.",
    contextTitle: problem.title,
    contextItems: [
      { label: "Difficulty", value: problem.difficulty },
      { label: "Estimated time", value: `${problem.estimatedMinutes} min` },
      {
        label: "Likely pattern",
        value: primaryPattern?.name ?? "Pattern not tagged",
      },
      {
        label: "Clues",
        value:
          problem.recognitionClues.length > 0
            ? problem.recognitionClues.join("; ")
            : "No saved clues.",
      },
      {
        label: "Mistakes",
        value:
          problem.commonMistakes.length > 0
            ? problem.commonMistakes.join("; ")
            : "No saved mistakes.",
      },
    ],
    focusChecklist: [
      "State the pattern signal from metadata.",
      "Explain the data structures and maintained invariant.",
      "Walk through the steps without writing code.",
      "Mention edge cases before complexity.",
    ],
    patternId: primaryPattern?.id,
    problemId: problem.id,
    difficulty: problem.difficulty,
    isAvailable: true,
  };
}

async function buildDebuggingPrompt(
  userProfileId: string,
): Promise<SpeakingDrillPrompt> {
  const failedRun = await getPrisma().codeRun.findFirst({
    where: {
      userProfileId,
      status: { in: ["Failed", "RuntimeError", "TimedOut", "ValidationError"] },
    },
    select: {
      id: true,
      status: true,
      stderr: true,
      errorMessage: true,
      runtimeMs: true,
      codeSubmission: {
        select: {
          problemId: true,
          attemptId: true,
          problem: {
            select: {
              title: true,
              difficulty: true,
              problemPatterns: {
                select: {
                  isPrimary: true,
                  pattern: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                orderBy: { isPrimary: "desc" },
              },
            },
          },
        },
      },
      testResults: {
        where: { passed: false },
        select: {
          name: true,
          errorMessage: true,
          expectedOutputJson: true,
          actualOutputJson: true,
        },
        take: 3,
      },
      debugInsights: {
        select: {
          summary: true,
          likelyCause: true,
          suggestedFix: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!failedRun) {
    return {
      id: "debugging:unavailable",
      drillType: "debugging",
      phase: "Approach",
      title: "Explain a debugging failure",
      eyebrow: "Explain a Debugging Failure",
      description: "Explain the likely cause and fix for a failed code run.",
      contextTitle: "No failed code run found",
      contextItems: [],
      focusChecklist: [],
      isAvailable: false,
      unavailableReason:
        "Run code in the workspace and save a failed run before using this drill.",
    };
  }

  const primaryPattern =
    failedRun.codeSubmission.problem.problemPatterns[0]?.pattern ?? null;
  const latestInsight = failedRun.debugInsights[0] ?? null;

  return {
    id: `debugging:${failedRun.id}`,
    drillType: "debugging",
    phase: "Approach",
    title: `Explain the failed run for ${failedRun.codeSubmission.problem.title}`,
    eyebrow: "Explain a Debugging Failure",
    description:
      "Explain the likely cause, the debugging evidence, and the smallest fix you would try next.",
    contextTitle: failedRun.codeSubmission.problem.title,
    contextItems: [
      { label: "Run status", value: failedRun.status },
      {
        label: "Pattern",
        value: primaryPattern?.name ?? "Pattern not tagged",
      },
      {
        label: "Runtime",
        value:
          typeof failedRun.runtimeMs === "number"
            ? `${failedRun.runtimeMs} ms`
            : "No runtime recorded",
      },
      {
        label: "Error",
        value:
          truncate(failedRun.errorMessage || failedRun.stderr, 320) ||
          "No error text recorded.",
      },
      {
        label: "Failed tests",
        value:
          failedRun.testResults.length > 0
            ? failedRun.testResults
                .map((testResult) =>
                  [
                    testResult.name,
                    testResult.errorMessage,
                    `expected ${JSON.stringify(testResult.expectedOutputJson)}`,
                    `actual ${JSON.stringify(testResult.actualOutputJson)}`,
                  ]
                    .filter(Boolean)
                    .join(": "),
                )
                .join("; ")
            : "No failed test details recorded.",
      },
      latestInsight
        ? {
            label: "Debug Coach",
            value: `${latestInsight.summary} ${latestInsight.likelyCause} ${latestInsight.suggestedFix}`,
          }
        : { label: "Debug Coach", value: "No saved debug insight." },
    ],
    focusChecklist: [
      "Name the observed failure signal.",
      "State the likely cause before proposing changes.",
      "Explain the smallest fix and why it should work.",
      "Mention how you would verify the fix.",
    ],
    patternId: primaryPattern?.id,
    problemId: failedRun.codeSubmission.problemId,
    attemptId: failedRun.codeSubmission.attemptId ?? undefined,
    codeRunId: failedRun.id,
    difficulty: failedRun.codeSubmission.problem.difficulty,
    isAvailable: true,
  };
}

async function buildComplexityPrompt(
  userProfileId: string,
): Promise<SpeakingDrillPrompt> {
  const [attempt, interviewRound] = await Promise.all([
    getPrisma().attempt.findFirst({
      where: { userProfileId },
      select: {
        id: true,
        problemId: true,
        solvedStatus: true,
        reflection: true,
        createdAt: true,
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
        correctPattern: {
          select: {
            id: true,
            name: true,
            templateSummary: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPrisma().interviewRound.findFirst({
      where: {
        interviewSession: {
          userProfileId,
          status: "Completed",
        },
        complexityText: { not: null },
      },
      select: {
        id: true,
        attemptId: true,
        problemId: true,
        complexityText: true,
        completedAt: true,
        problem: {
          select: {
            title: true,
            difficulty: true,
          },
        },
        correctPattern: {
          select: {
            id: true,
            name: true,
            templateSummary: true,
          },
        },
      },
      orderBy: { completedAt: "desc" },
    }),
  ]);
  const useInterviewRound =
    interviewRound?.completedAt &&
    (!attempt || interviewRound.completedAt > attempt.createdAt);

  if (!attempt && !interviewRound) {
    return {
      id: "complexity:unavailable",
      drillType: "complexity",
      phase: "Complexity",
      title: "Explain complexity",
      eyebrow: "Explain Complexity",
      description: "Explain time and space complexity from previous work.",
      contextTitle: "No previous attempt or interview found",
      contextItems: [],
      focusChecklist: [],
      isAvailable: false,
      unavailableReason:
        "Complete a practice attempt or mock interview before using this drill.",
    };
  }

  const source = useInterviewRound ? interviewRound : attempt;

  if (!source) {
    throw new Error("Complexity source is required.");
  }

  const pattern = source.correctPattern;
  const priorComplexity =
    "complexityText" in source ? source.complexityText : null;
  const sourceAttemptId =
    "reflection" in source ? source.id : source.attemptId ?? undefined;
  const sourceInterviewRoundId = "complexityText" in source ? source.id : undefined;

  return {
    id: `complexity:${"id" in source ? source.id : "source"}`,
    drillType: "complexity",
    phase: "Complexity",
    title: `Explain complexity for ${source.problem.title}`,
    eyebrow: "Explain Complexity",
    description:
      "Explain time and space complexity and tie each term to loops, data structures, or maintained state.",
    contextTitle: source.problem.title,
    contextItems: [
      { label: "Difficulty", value: source.problem.difficulty },
      { label: "Pattern", value: pattern.name },
      { label: "Template", value: pattern.templateSummary },
      {
        label: "Previous note",
        value:
          truncate(priorComplexity || ("reflection" in source ? source.reflection : null)) ||
          "No saved explanation text.",
      },
    ],
    focusChecklist: [
      "State time complexity in Big-O terms.",
      "Tie time complexity to the dominant loop or traversal.",
      "State space complexity and what data structure drives it.",
      "Mention whether input storage is counted.",
    ],
    patternId: pattern.id,
    problemId: source.problemId,
    attemptId: sourceAttemptId,
    interviewRoundId: sourceInterviewRoundId,
    difficulty: source.problem.difficulty,
    isAvailable: true,
  };
}

async function buildSpeakingPrompts({
  userProfileId,
  patternId,
}: {
  userProfileId: string;
  patternId?: string;
}): Promise<SpeakingDrillPrompt[]> {
  const [approachPrompt, debuggingPrompt, complexityPrompt] = await Promise.all([
    buildApproachPrompt(),
    buildDebuggingPrompt(userProfileId),
    buildComplexityPrompt(userProfileId),
  ]);

  return [
    buildPatternPrompt(patternId),
    approachPrompt,
    debuggingPrompt,
    complexityPrompt,
  ];
}

export default async function SpeakingDrillPage({
  searchParams,
}: SpeakingDrillPageProps) {
  const [{ type, patternId }, userProfile] = await Promise.all([
    searchParams,
    ensureCurrentUserProfile(),
  ]);

  if (!userProfile) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Speaking Practice
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
            Sign in to practice spoken explanations
          </h1>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
            Speaking drills use your PatternForge history for debugging and
            complexity prompts. Audio storage is disabled by default.
          </p>
          <SignInButton mode="modal">
            <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
              Sign in
            </button>
          </SignInButton>
        </section>
      </main>
    );
  }

  const prompts = await buildSpeakingPrompts({
    userProfileId: userProfile.id,
    patternId,
  });

  return (
    <SpeakingDrillClient
      prompts={prompts}
      initialDrillType={normalizeDrillType(type)}
      patterns={patterns.map((pattern) => ({
        id: pattern.id,
        name: pattern.name,
      }))}
    />
  );
}
