import { buildAIPromptContext } from "@/lib/ai/safety";
import type { AIPromptMessage } from "@/lib/ai/types";
import type { ScoreCommunicationInput } from "@/lib/ai/scoreCommunication";

export function buildCommunicationScoringMessages(
  input: ScoreCommunicationInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: [
        "You are the PatternForge Communication Scorer.",
        "Score spoken interview communication from transcripts, saved interview messages, phase notes, code run summaries, and final feedback.",
        "Be encouraging but honest.",
        "Do not over-penalize short transcripts; use all available written and spoken evidence.",
        "If transcript evidence is sparse, explicitly say confidence in communication scoring is limited.",
        "Infer confidence only from wording in the transcript, such as decisive or hedging language.",
        "Do not claim to hear tone, volume, emotion, pauses, or vocal confidence unless explicit audio analysis features are provided.",
        "Use code run results only as context for how clearly the user explained testing/debugging; do not claim official correctness.",
        "Return valid JSON only. Do not wrap JSON in markdown.",
      ].join(" "),
    },
    {
      role: "user",
      content: [
        "Score this completed PatternForge mock interview communication.",
        "Scoring dimensions:",
        "Clarity: Was the explanation understandable?",
        "Structure: Did the user organize the approach before details?",
        "Conciseness: Did the user avoid unnecessary rambling?",
        "Confidence: Did the transcript wording sound decisive? Evaluate only words/transcripts, not actual vocal tone.",
        "Technical Explanation: Did the user explain pattern, invariant, data structures, tests, and complexity?",
        "Communication insights must use only these insightType values: UnclearApproach, MissingInvariant, TooVerbose, TooQuietOrUncertain, StrongExplanation, WeakTestingExplanation, WeakComplexityExplanation, GoodTradeoffDiscussion.",
        "Use severity Low, Medium, or High.",
        "Return JSON matching this TypeScript shape:",
        `{
  "clarityScore": number,
  "structureScore": number,
  "concisenessScore": number,
  "confidenceScore": number,
  "technicalExplanationScore": number,
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "suggestedPractice": string[],
  "communicationInsights": [
    {
      "insightType": "UnclearApproach" | "MissingInvariant" | "TooVerbose" | "TooQuietOrUncertain" | "StrongExplanation" | "WeakTestingExplanation" | "WeakComplexityExplanation" | "GoodTradeoffDiscussion",
      "severity": "Low" | "Medium" | "High",
      "summary": string,
      "evidence": { "phase"?: string, "quote"?: string, "reason"?: string }
    }
  ]
        }`,
        "PatternForge communication scoring input:",
        buildAIPromptContext(input, { label: "Communication scoring context" }),
      ].join("\n\n"),
    },
  ];
}
