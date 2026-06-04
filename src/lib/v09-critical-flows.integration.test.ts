import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import type { AIReviewOutput } from "@/lib/ai/types";
import { getPrisma } from "@/lib/prisma";

const runDatabaseTests = process.env.PATTERNFORGE_RUN_DB_TESTS === "1";
const dbTest = runDatabaseTests ? test : test.skip;
const ownerAuthUserId = "v09-critical-owner";
const otherAuthUserId = "v09-critical-other";

const fakeReview: AIReviewOutput = {
  patternScore: 8,
  implementationScore: 7,
  complexityScore: 7,
  explanationScore: 8,
  feedbackSummary: "Pattern recognition was solid and implementation evidence was reasonable.",
  strengths: ["Recognized complement lookup"],
  weaknesses: ["Add one edge-case explanation"],
  complexityFeedback: "State the map storage cost explicitly.",
  suggestedMistakes: [
    {
      mistakeType: "edge cases",
      description: "Edge cases were not fully explained.",
      correction: "Name duplicate and no-match behavior before coding.",
    },
  ],
  suggestedFlashcards: [
    {
      front: "What signal suggests Arrays & Hashing?",
      back: "Need fast lookup for a complement, count, or previously seen value.",
    },
  ],
  suggestedNextStep: "Practice one more complement lookup problem.",
};

async function resetUsers() {
  await getPrisma().userProfile.deleteMany({
    where: {
      authUserId: {
        in: [ownerAuthUserId, otherAuthUserId],
      },
    },
  });
}

async function createUser(authUserId: string) {
  return getPrisma().userProfile.create({
    data: {
      authUserId,
      displayName: authUserId,
    },
  });
}

async function assertSeedDataAvailable() {
  const [problem, pattern] = await Promise.all([
    getPrisma().problem.findUnique({ where: { id: "two-sum" } }),
    getPrisma().pattern.findUnique({ where: { id: "arrays-hashing" } }),
  ]);

  assert.ok(problem, "Expected seeded problem two-sum.");
  assert.ok(pattern, "Expected seeded pattern arrays-hashing.");
}

async function createAttempt({
  userProfileId,
  problemId,
  selectedPatternId,
  solvedStatus,
  timeSpentMinutes,
  confidence,
  reflection,
}: {
  userProfileId: string;
  problemId: string;
  selectedPatternId: string;
  solvedStatus: "Solved" | "PartiallySolved" | "NotSolved";
  timeSpentMinutes: number;
  confidence: number;
  reflection: string;
}) {
  const problem = await getPrisma().problem.findUniqueOrThrow({
    where: { id: problemId },
    include: {
      problemPatterns: true,
    },
  });
  const correctPatternId =
    problem.problemPatterns.find((pattern) => pattern.isPrimary)?.patternId ??
    selectedPatternId;

  return getPrisma().attempt.create({
    data: {
      userProfileId,
      problemId,
      selectedPatternId,
      correctPatternId,
      wasPatternCorrect: selectedPatternId === correctPatternId,
      solvedStatus,
      timeSpentMinutes,
      confidence,
      reflection,
    },
  });
}

dbTest("attempt, AI review, review submission, and recommendations stay user scoped", async () => {
  const { createAIReviewForUserProfile } = await import("@/lib/ai-review-service");
  const { generateRecommendations } = await import(
    "@/lib/recommendations/engine"
  );
  const { submitFlashcardReview } = await import("@/lib/review/queue");

  await resetUsers();
  await assertSeedDataAvailable();

  const owner = await createUser(ownerAuthUserId);
  const other = await createUser(otherAuthUserId);
  const ownerAttempt = await createAttempt({
    userProfileId: owner.id,
    problemId: "two-sum",
    selectedPatternId: "arrays-hashing",
    solvedStatus: "Solved",
    timeSpentMinutes: 14,
    confidence: 4,
    reflection: "I used complement lookup in a hash map and checked before inserting.",
  });
  const otherAttempt = await createAttempt({
    userProfileId: other.id,
    problemId: "valid-anagram",
    selectedPatternId: "arrays-hashing",
    solvedStatus: "PartiallySolved",
    timeSpentMinutes: 18,
    confidence: 3,
    reflection: "I counted characters but missed one comparison.",
  });

  const review = await createAIReviewForUserProfile(
    {
      attemptId: ownerAttempt.id,
      userCode: "def solve(nums, target):\n    return []\n",
      userExplanation: "Use a map from value to index and check complements.",
    },
    owner.id,
    async () => fakeReview,
  );
  const flashcard = await getPrisma().flashcard.findFirstOrThrow({
    where: {
      userProfileId: owner.id,
      sourceAttemptId: ownerAttempt.id,
    },
  });
  const submittedReview = await submitFlashcardReview(
    owner.id,
    flashcard.id,
    "Good",
  );
  const recommendations = await generateRecommendations(owner.id);

  assert.equal(review.attemptId, ownerAttempt.id);
  assert.equal(submittedReview.itemType, "Flashcard");
  assert.ok(recommendations.length > 0);
  assert.equal(
    await getPrisma().aIReview.count({ where: { userProfileId: other.id } }),
    0,
  );
  assert.equal(
    await getPrisma().attempt.count({
      where: {
        userProfileId: owner.id,
        id: otherAttempt.id,
      },
    }),
    0,
  );
});

dbTest("battle, interview, code run, voice turn, and export scopes stay user scoped", async () => {
  const { createBattleFromRounds } = await import("@/lib/battles/generateBattle");

  await resetUsers();
  await assertSeedDataAvailable();

  const owner = await createUser(ownerAuthUserId);
  const other = await createUser(otherAuthUserId);
  const battle = await createBattleFromRounds(owner.id, {
    battleType: "PatternBoss",
    title: "Arrays & Hashing Boss Battle",
    targetPatternId: "arrays-hashing",
    rounds: [
      {
        problemId: "two-sum",
        roundNumber: 1,
        roundType: "BossProblem",
        expectedPatternId: "arrays-hashing",
      },
    ],
  });
  const interview = await getPrisma().interviewSession.create({
    data: {
      userProfileId: owner.id,
      interviewType: "SingleProblem",
      title: "Single Problem Interview",
      targetPatternId: "arrays-hashing",
      difficultyTarget: "Easy",
      durationMinutes: 30,
      rounds: {
        create: {
          problemId: "two-sum",
          roundNumber: 1,
          correctPatternId: "arrays-hashing",
          status: "Active",
        },
      },
    },
    include: {
      rounds: true,
    },
  });
  const codeSubmission = await getPrisma().codeSubmission.create({
    data: {
      userProfileId: owner.id,
      problemId: "two-sum",
      interviewRoundId: interview.rounds[0]?.id,
      language: "Python",
      code: "def solve(nums, target):\n    return []\n",
      status: "Draft",
    },
  });
  const codeRun = await getPrisma().codeRun.create({
    data: {
      userProfileId: owner.id,
      codeSubmissionId: codeSubmission.id,
      runType: "CustomTests",
      status: "Succeeded",
      stdout: "ok",
      stderr: "",
      runtimeMs: 12,
    },
  });
  const otherCodeSubmission = await getPrisma().codeSubmission.create({
    data: {
      userProfileId: other.id,
      problemId: "two-sum",
      language: "Python",
      code: "def solve(nums, target):\n    return [0, 1]\n",
      status: "Draft",
    },
  });
  const otherCodeRun = await getPrisma().codeRun.create({
    data: {
      userProfileId: other.id,
      codeSubmissionId: otherCodeSubmission.id,
      runType: "CustomTests",
      status: "Failed",
      stdout: "other",
      stderr: "",
    },
  });
  const voiceSession = await getPrisma().voiceSession.create({
    data: {
      userProfileId: owner.id,
      interviewSessionId: interview.id,
      status: "Active",
    },
  });
  const voiceTurn = await getPrisma().voiceTurn.create({
    data: {
      voiceSessionId: voiceSession.id,
      interviewSessionId: interview.id,
      interviewRoundId: interview.rounds[0]?.id,
      phase: "Approach",
      speaker: "User",
      transcript: "I will explain the complement lookup approach.",
      durationMs: 20_000,
    },
  });

  await getPrisma().battle.update({
    where: { id: battle.id },
    data: {
      status: "Completed",
      result: "Victory",
      completedAt: new Date(),
      xpEarned: 100,
    },
  });
  await getPrisma().interviewSession.update({
    where: { id: interview.id },
    data: {
      status: "Completed",
      completedAt: new Date(),
      overallScore: 82,
      result: "Hire",
    },
  });

  assert.equal(
    await getPrisma().battle.count({ where: { userProfileId: owner.id } }),
    1,
  );
  assert.equal(
    await getPrisma().interviewSession.count({
      where: { userProfileId: owner.id },
    }),
    1,
  );
  assert.equal(
    await getPrisma().codeRun.count({
      where: { userProfileId: owner.id, id: codeRun.id },
    }),
    1,
  );
  assert.equal(
    await getPrisma().voiceTurn.count({
      where: {
        id: voiceTurn.id,
        interviewSession: {
          userProfileId: owner.id,
        },
      },
    }),
    1,
  );
  assert.equal(
    await getPrisma().codeRun.count({
      where: { userProfileId: other.id, id: codeRun.id },
    }),
    0,
  );
  const exportedOwnerCodeSubmissions = await getPrisma().codeSubmission.findMany({
    where: { userProfileId: owner.id },
    select: { id: true },
  });
  const exportedOwnerCodeRuns = await getPrisma().codeRun.findMany({
    where: { userProfileId: owner.id },
    select: { id: true },
  });

  assert.deepEqual(
    exportedOwnerCodeSubmissions.map((submission) => submission.id),
    [codeSubmission.id],
  );
  assert.deepEqual(
    exportedOwnerCodeRuns.map((run) => run.id),
    [codeRun.id],
  );
  assert.ok(
    !exportedOwnerCodeSubmissions.some(
      (submission) => submission.id === otherCodeSubmission.id,
    ),
  );
  assert.ok(!exportedOwnerCodeRuns.some((run) => run.id === otherCodeRun.id));
  assert.equal(
    await getPrisma().voiceTurn.count({
      where: {
        id: voiceTurn.id,
        interviewSession: {
          userProfileId: other.id,
        },
      },
    }),
    0,
  );
});
