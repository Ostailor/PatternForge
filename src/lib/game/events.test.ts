import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGameEventKey,
  getLegacySourceId,
  summarizeXPBreakdown,
} from "@/lib/game/events";

test("buildGameEventKey uses user, event type, and linked source metadata", () => {
  assert.equal(
    buildGameEventKey("user-1", "AttemptCompleted", { attemptId: "attempt-1" }),
    "user-1:AttemptCompleted:attempt:attempt-1",
  );
  assert.equal(
    buildGameEventKey("user-1", "ReviewCompleted", { reviewLogId: "review-1" }),
    "user-1:ReviewCompleted:reviewLog:review-1",
  );
});

test("getLegacySourceId reads supported metadata link fields", () => {
  assert.equal(getLegacySourceId({ battleId: "battle-1" }), "battle-1");
  assert.equal(getLegacySourceId({ interviewId: "interview-1" }), "interview-1");
  assert.equal(getLegacySourceId({ questId: "quest-1" }), "quest-1");
  assert.equal(getLegacySourceId({ achievementId: "achievement-1" }), "achievement-1");
  assert.equal(getLegacySourceId({ contrastDrillId: "drill-1" }), "drill-1");
  assert.equal(getLegacySourceId({}), null);
});

test("summarizeXPBreakdown groups XP by game event type", () => {
  assert.deepEqual(
    summarizeXPBreakdown([
      { eventType: "AttemptCompleted", xpAmount: 40 },
      { eventType: "ReviewCompleted", xpAmount: 10 },
      { eventType: "AttemptCompleted", xpAmount: 15 },
    ]),
    {
      AttemptCompleted: 55,
      ReviewCompleted: 10,
      BattleCompleted: 0,
      InterviewStarted: 0,
      InterviewCompleted: 0,
      InterviewStrongResult: 0,
      InterviewImprovement: 0,
      QuestCompleted: 0,
      AchievementEarned: 0,
      ContrastDrillCompleted: 0,
      total: 65,
    },
  );
});
