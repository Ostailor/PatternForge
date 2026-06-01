import "server-only";

import {
  AIConfigurationError,
  AIResponseError,
  AIResponseParseError,
} from "@/lib/ai/errors";
import type { AIPromptMessage } from "@/lib/ai/types";

export { AIConfigurationError, AIResponseError, AIResponseParseError };

// Server-only provider boundary: API keys are read from unprefixed environment
// variables and must never be passed through client components or NEXT_PUBLIC_*.
type AIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type StructuredJsonRequest = {
  messages: AIPromptMessage[];
  temperature?: number;
  maxTokens?: number;
};

type OpenAICompatibleResponse = {
  choices?: {
    message?: {
      content?: string | null;
    };
  }[];
};

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function getProviderConfig(): AIProviderConfig {
  const provider = process.env.AI_PROVIDER ?? "openai-compatible";

  if (provider !== "openai-compatible" && provider !== "openai") {
    throw new AIConfigurationError(
      `Unsupported AI_PROVIDER "${provider}". Use "openai-compatible" or "openai".`,
    );
  }

  const apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new AIConfigurationError(
      "Missing AI provider API key. Set AI_API_KEY or OPENAI_API_KEY on the server.",
    );
  }

  const model = process.env.AI_MODEL ?? process.env.OPENAI_MODEL;

  if (!model) {
    throw new AIConfigurationError(
      "Missing AI provider model. Set AI_MODEL or OPENAI_MODEL on the server.",
    );
  }

  return {
    baseUrl: trimTrailingSlash(
      process.env.AI_BASE_URL ??
        process.env.OPENAI_BASE_URL ??
        "https://api.openai.com/v1",
    ),
    apiKey,
    model,
  };
}

function parseJsonContent(content: string): unknown {
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

export async function requestStructuredJson({
  messages,
  temperature = 0.2,
  maxTokens = 1200,
}: StructuredJsonRequest): Promise<unknown> {
  const config = getProviderConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new AIResponseError(
      `AI provider request failed with status ${response.status}.`,
      response.status,
      body.slice(0, 1000),
    );
  }

  let payload: OpenAICompatibleResponse;

  try {
    payload = (await response.json()) as OpenAICompatibleResponse;
  } catch {
    throw new AIResponseParseError(
      "AI provider returned a response body that was not valid JSON.",
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new AIResponseError("AI provider response did not include content.");
  }

  return parseJsonContent(content);
}
