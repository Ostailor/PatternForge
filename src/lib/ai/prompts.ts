import type {
  AIHintInput,
  AIPromptMessage,
  AIReviewInput,
} from "@/lib/ai/types";
import { buildAIPromptContext } from "@/lib/ai/safety";

const coachSystemPrompt = [
  "You are the PatternForge AI Coach.",
  "Act like a coding interview pattern tutor, not a generic code reviewer.",
  "Teach the user to recognize patterns, explain why they apply, and remember the key lesson for next time.",
  "Use only PatternForge metadata and user-provided code or explanation.",
  "Do not include or reconstruct LeetCode problem statements.",
  "Do not claim that code passed tests unless that fact is explicitly present in the input.",
  "Avoid giving a full solution unless it is necessary to explain a serious mistake.",
  "Use a clear, direct, encouraging tone. Stay concise and learning-focused.",
  "Return valid JSON only. Do not wrap the JSON in markdown.",
].join(" ");

// Product constraints: PatternForge does not scrape LeetCode and does not store
// full LeetCode statements. Prompts must use only user-provided content and
// PatternForge metadata. The AI must not claim tests passed unless tests
// actually ran and that result is included in the input.
export function buildReviewSolutionMessages(
  input: AIReviewInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: coachSystemPrompt,
    },
    {
      role: "user",
      content: [
        "Review this PatternForge attempt.",
        "Use scores from 1 to 10, where 10 means strong independent mastery.",
        "Evaluate these points explicitly before writing the JSON: did the user recognize the correct pattern, did they understand why the pattern applies, is the implementation likely correct, is the time complexity correct, is the space complexity correct, what mistake are they most likely making, what should they remember next time, and what flashcards would help retention.",
        "patternScore should reflect pattern recognition and whether the user understood why the correct pattern applies.",
        "implementationScore should reflect likely implementation correctness from the pasted code or explanation.",
        "complexityScore should reflect both time complexity and space complexity reasoning.",
        "explanationScore should reflect clarity and whether the user can explain the approach in interview terms.",
        "If userCode is missing, review the explanation and reflection instead and clearly note that implementation confidence is limited.",
        "If userExplanation is missing, review the code and reflection instead and clearly note that explanation confidence is limited.",
        "If codeExecution is present, use its run status, failed custom test summaries, stdout, stderr, and runtime error as evidence, but describe it only as PatternForge custom test or self-test evidence.",
        "If the user selected the wrong pattern, explain the difference between the selected pattern and the correct pattern.",
        "If the implementation seems incomplete, say so honestly.",
        "Do not pretend to run code. Do not claim the code passes all tests unless execution actually happened.",
        "Keep feedback concise, specific, actionable, and focused on learning.",
        "Return JSON matching this TypeScript shape:",
        `{
  "patternScore": number,
  "implementationScore": number,
  "complexityScore": number,
  "explanationScore": number,
  "feedbackSummary": string,
  "strengths": string[],
  "weaknesses": string[],
  "complexityFeedback": string,
  "suggestedMistakes": [
    { "mistakeType": string, "description": string, "correction": string }
  ],
  "suggestedFlashcards": [
    { "front": string, "back": string }
  ],
  "suggestedNextStep": string
        }`,
        "PatternForge attempt input:",
        buildAIPromptContext(input, { label: "AI review context" }),
      ].join("\n\n"),
    },
  ];
}

export function buildGenerateHintsMessages(
  input: AIHintInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: coachSystemPrompt,
    },
    {
      role: "user",
      content: [
        "Generate a five-level hint ladder for this PatternForge problem without giving away a full code solution.",
        "Use only the provided PatternForge metadata: title, difficulty, recognition clues, common mistakes, primary pattern, and secondary patterns.",
        "Do not include or reconstruct a LeetCode problem statement.",
        "Return exactly five hints with these titles in this order: Pattern clue; Key invariant or data structure; Pointer/recurrence/state transition guidance; Edge case or common pitfall; High-level pseudocode.",
        "Hint 1 may name or strongly imply the primary pattern because the user explicitly asked for a pattern clue.",
        "Hint 5 may use high-level pseudocode, but must not include runnable code, language-specific syntax, or a full implementation.",
        "Keep each hint short, direct, and learning-focused.",
        "Return JSON matching this TypeScript shape:",
        `{
  "levels": [
    { "level": 1, "title": "Pattern clue", "hint": string },
    { "level": 2, "title": "Key invariant or data structure", "hint": string },
    { "level": 3, "title": "Pointer/recurrence/state transition guidance", "hint": string },
    { "level": 4, "title": "Edge case or common pitfall", "hint": string },
    { "level": 5, "title": "High-level pseudocode", "hint": string }
  ]
        }`,
        "PatternForge problem metadata:",
        buildAIPromptContext(input, { label: "AI hint context" }),
      ].join("\n\n"),
    },
  ];
}
