import "dotenv/config";

import assert from "node:assert/strict";
import test from "node:test";

import {
  AIReviewAttemptAccessError,
  AIReviewDailyLimitError,
  createAIReviewForUserProfile,
} from "@/lib/ai-review-service";
import { DAILY_AI_REVIEW_LIMIT } from "@/lib/ai-review-limits";
import type { AIReviewOutput } from "@/lib/ai/types";
import { getPrisma } from "@/lib/prisma";

const runDatabaseTests = process.env.PATTERNFORGE_RUN_DB_TESTS === "1";
const dbTest = runDatabaseTests ? test : test.skip;
const testAuthUserIds = [
  "owner-test-user",
  "other-test-user",
  "daily-limit-user",
];

const fakeReview: AIReviewOutput = {
  patternScore: 8,
  implementationScore: 7,
  complexityScore: 6,
  explanationScore: 9,
  feedbackSummary: "You recognized the pattern and explained the tradeoff.",
  strengths: ["Clear pattern recognition"],
  weaknesses: ["Edge cases need a tighter explanation"],
  complexityFeedback: "State both time and space complexity explicitly.",
  suggestedMistakes: [
    {
      mistakeType: "complexity",
      description: "The complexity analysis was incomplete.",
      correction: "Explain the dominant loop and auxiliary storage.",
    },
  ],
  suggestedFlashcards: [
    {
      front: "When does hash map lookup replace nested scanning?",
      back: "When complements or previously seen values answer the query.",
    },
  ],
  suggestedNextStep: "Practice one related problem and explain complexity aloud.",
};

async function resetUserData() {
  await getPrisma().userProfile.deleteMany({
    where: {
      authUserId: { in: testAuthUserIds },
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

async function createAttempt(userProfileId: string) {
  return getPrisma().attempt.create({
    data: {
      userProfileId,
      problemId: "two-sum",
      selectedPatternId: "arrays-hashing",
      correctPatternId: "arrays-hashing",
      wasPatternCorrect: true,
      solvedStatus: "Solved",
      timeSpentMinutes: 12,
      confidence: 4,
      reflection: "I used a hash map to avoid a nested scan.",
    },
  });
}

dbTest("AI review saves review, mistake, and flashcard for the owning user only", async () => {
  await resetUserData();

  const owner = await createUser("owner-test-user");
  const otherUser = await createUser("other-test-user");
  const attempt = await createAttempt(owner.id);

  const review = await createAIReviewForUserProfile(
    {
      attemptId: attempt.id,
      userCode: "function twoSum() { return []; }",
      userExplanation: "I used complements in a map.",
    },
    owner.id,
    async () => fakeReview,
  );

  assert.equal(review.attemptId, attempt.id);
  assert.equal(review.problemTitle, "Two Sum");
  assert.equal(await getPrisma().aIReview.count({ where: { userProfileId: owner.id } }), 1);
  assert.equal(await getPrisma().mistake.count({ where: { userProfileId: owner.id } }), 1);
  assert.equal(await getPrisma().flashcard.count({ where: { userProfileId: owner.id } }), 1);
  const [savedMistake, savedFlashcard] = await Promise.all([
    getPrisma().mistake.findFirstOrThrow({ where: { userProfileId: owner.id } }),
    getPrisma().flashcard.findFirstOrThrow({ where: { userProfileId: owner.id } }),
  ]);

  assert.ok(savedMistake.reviewDueAt instanceof Date);
  assert.equal(savedMistake.lastReviewedAt, null);
  assert.equal(savedMistake.intervalDays, 0);
  assert.equal(savedMistake.easeFactor, 2.5);
  assert.equal(savedMistake.repetitions, 0);
  assert.equal(savedMistake.lapses, 0);
  assert.equal(savedMistake.status, "active");
  assert.ok(savedFlashcard.reviewDueAt instanceof Date);
  assert.equal(savedFlashcard.lastReviewedAt, null);
  assert.equal(savedFlashcard.intervalDays, 0);
  assert.equal(savedFlashcard.easeFactor, 2.5);
  assert.equal(savedFlashcard.repetitions, 0);
  assert.equal(savedFlashcard.lapses, 0);
  assert.equal(savedFlashcard.status, "active");

  await assert.rejects(
    () =>
      createAIReviewForUserProfile(
        {
          attemptId: attempt.id,
          userCode: "function twoSum() { return []; }",
          userExplanation: "I used complements in a map.",
        },
        otherUser.id,
        async () => fakeReview,
      ),
    AIReviewAttemptAccessError,
  );
});

dbTest("AI review enforces the per-user daily review limit", async () => {
  await resetUserData();

  const owner = await createUser("daily-limit-user");
  const attempt = await createAttempt(owner.id);

  for (let index = 0; index < DAILY_AI_REVIEW_LIMIT; index += 1) {
    await createAIReviewForUserProfile(
      {
        attemptId: attempt.id,
        userCode: `function twoSum${index}() { return []; }`,
        userExplanation: "Hash lookup.",
      },
      owner.id,
      async () => fakeReview,
    );
  }

  await assert.rejects(
    () =>
      createAIReviewForUserProfile(
        {
          attemptId: attempt.id,
          userCode: "function extra() { return []; }",
          userExplanation: "One more review.",
        },
        owner.id,
        async () => fakeReview,
      ),
    AIReviewDailyLimitError,
  );
});
