import "server-only";

import { requestStructuredJson } from "@/lib/ai/client";
import { buildReviewSolutionMessages } from "@/lib/ai/prompts";
import { parseAIReviewOutput } from "@/lib/ai/reviewParsing";
import type { AIReviewInput, AIReviewOutput } from "@/lib/ai/types";

export { parseAIReviewOutput };

export async function reviewSolution(
  input: AIReviewInput,
): Promise<AIReviewOutput> {
  const response = await requestStructuredJson({
    messages: buildReviewSolutionMessages(input),
    temperature: 0.2,
    maxTokens: 1400,
  });

  return parseAIReviewOutput(response);
}
