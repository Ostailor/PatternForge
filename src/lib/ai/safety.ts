import { AIResponseError, AIResponseParseError } from "@/lib/ai/errors";

type AIInputSizeOptions = {
  label?: string;
  maxCharacters?: number;
};

type RedactionOptions = {
  maxStringCharacters?: number;
};

export type AIInputSizeValidation =
  | {
      ok: true;
      characters: number;
    }
  | {
      ok: false;
      characters: number;
      message: string;
    };

const DEFAULT_MAX_AI_INPUT_CHARACTERS = 60_000;
const DEFAULT_MAX_AI_STRING_CHARACTERS = 20_000;
const REDACTED_VALUE = "[redacted]";
const TRUNCATED_SUFFIX = "\n[truncated for AI context]";
const SENSITIVE_FIELD_PATTERN =
  /^(authorization|cookie|set-cookie|password|passcode|secret|token|accessToken|refreshToken|apiKey|api_key|providerMetadata|rawProviderResponse|rawResponse|rawAudio|audioBlob|audioUrl|storageKey|authUserId|email)$/i;

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);

  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function stringifyForSize(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getMaxInputCharacters(options?: AIInputSizeOptions): number {
  return (
    options?.maxCharacters ??
    readPositiveIntegerEnv(
      "PATTERNFORGE_AI_MAX_INPUT_CHARS",
      DEFAULT_MAX_AI_INPUT_CHARACTERS,
    )
  );
}

function getMaxStringCharacters(options?: RedactionOptions): number {
  return (
    options?.maxStringCharacters ??
    readPositiveIntegerEnv(
      "PATTERNFORGE_AI_MAX_STRING_CHARS",
      DEFAULT_MAX_AI_STRING_CHARACTERS,
    )
  );
}

export function validateAIInputSize(
  value: unknown,
  options?: AIInputSizeOptions,
): AIInputSizeValidation {
  const label = options?.label ?? "AI input";
  const maxCharacters = getMaxInputCharacters(options);
  const characters = stringifyForSize(value).length;

  if (characters > maxCharacters) {
    return {
      ok: false,
      characters,
      message: `${label} is too large for AI processing. Keep it under ${maxCharacters.toLocaleString()} characters.`,
    };
  }

  return { ok: true, characters };
}

export function safeParseAIJson(content: string): unknown {
  const trimmed = content.trim();
  const fencedJson = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const jsonText = fencedJson?.[1] ?? trimmed;

  try {
    return JSON.parse(jsonText);
  } catch {
    throw new AIResponseParseError(
      "AI provider returned a response that was not valid JSON.",
    );
  }
}

export function redactSensitiveFieldsForAI(
  value: unknown,
  options?: RedactionOptions,
): unknown {
  const maxStringCharacters = getMaxStringCharacters(options);
  const seen = new WeakSet<object>();

  function redact(current: unknown): unknown {
    if (typeof current === "string") {
      return current.length > maxStringCharacters
        ? `${current.slice(0, maxStringCharacters)}${TRUNCATED_SUFFIX}`
        : current;
    }

    if (typeof current !== "object" || current === null) {
      return current;
    }

    if (seen.has(current)) {
      return "[circular]";
    }

    seen.add(current);

    if (current instanceof Date) {
      return current.toISOString();
    }

    if (Array.isArray(current)) {
      return current.map(redact);
    }

    return Object.fromEntries(
      Object.entries(current as Record<string, unknown>).map(([key, item]) => [
        key,
        SENSITIVE_FIELD_PATTERN.test(key) ? REDACTED_VALUE : redact(item),
      ]),
    );
  }

  return redact(value);
}

export function buildAIPromptContext(
  value: unknown,
  options?: AIInputSizeOptions & RedactionOptions,
): string {
  const context = JSON.stringify(redactSensitiveFieldsForAI(value, options), null, 2);
  const validation = validateAIInputSize(context, options);

  if (!validation.ok) {
    throw new AIResponseError(validation.message);
  }

  return context;
}
