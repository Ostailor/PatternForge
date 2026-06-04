import assert from "node:assert/strict";
import test from "node:test";

import { AIResponseError, AIResponseParseError } from "@/lib/ai/errors";
import {
  buildAIPromptContext,
  redactSensitiveFieldsForAI,
  safeParseAIJson,
  validateAIInputSize,
} from "@/lib/ai/safety";

test("safeParseAIJson accepts raw and fenced JSON", () => {
  assert.deepEqual(safeParseAIJson('{"ok":true}'), { ok: true });
  assert.deepEqual(safeParseAIJson('```json\n{"ok":true}\n```'), { ok: true });
});

test("safeParseAIJson rejects malformed AI output with a controlled error", () => {
  assert.throws(
    () => safeParseAIJson("Here is some prose instead of JSON."),
    AIResponseParseError,
  );
});

test("validateAIInputSize reports oversized prompt inputs without throwing", () => {
  const result = validateAIInputSize("abcdef", {
    label: "Test prompt",
    maxCharacters: 5,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /Test prompt is too large/);
});

test("redactSensitiveFieldsForAI removes provider, auth, and raw audio fields", () => {
  assert.deepEqual(
    redactSensitiveFieldsForAI({
      userCode: "print('needed for review')",
      providerMetadata: { requestId: "provider-request" },
      authUserId: "user_123",
      rawAudio: "binary-ish-data",
      nested: {
        apiKey: "secret",
        transcript: "keep transcript when intentionally provided",
      },
    }),
    {
      userCode: "print('needed for review')",
      providerMetadata: "[redacted]",
      authUserId: "[redacted]",
      rawAudio: "[redacted]",
      nested: {
        apiKey: "[redacted]",
        transcript: "keep transcript when intentionally provided",
      },
    },
  );
});

test("buildAIPromptContext rejects oversized redacted context before provider calls", () => {
  assert.throws(
    () =>
      buildAIPromptContext(
        { message: "too long" },
        { label: "Tiny context", maxCharacters: 5 },
      ),
    AIResponseError,
  );
});
