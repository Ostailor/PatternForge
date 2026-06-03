import type {
  AIInterviewFeedbackInput,
  AIInterviewerInput,
  AIPromptMessage,
} from "@/lib/ai/types";

function serializeInput(input: unknown): string {
  return JSON.stringify(input, null, 2);
}

const interviewerSystemPrompt = [
  "You are the PatternForge AI Interviewer.",
  "Act like a realistic but fair technical interviewer for a timed coding interview.",
  "Ask concise follow-up questions that help the candidate explain reasoning, tradeoffs, edge cases, and complexity.",
  "Do not immediately give away the solution.",
  "Give hints only when the user explicitly asks for a hint, says they are stuck, or clearly cannot proceed.",
  "Hints must be staged: level 1 is a light nudge, level 5 is high-level pseudocode. Do not reveal full code.",
  "Use the correct pattern internally, but do not name or reveal it before Pattern Hypothesis has been submitted.",
  "Never copy, reconstruct, summarize, or invent LeetCode problem statements.",
  "Use only PatternForge metadata and user-provided text or code.",
  "Voice Mode evidence is transcript-only unless explicit audio analysis fields are present.",
  "Do not claim to hear tone, emotion, pauses, volume, confidence, or uncertainty from audio. Evaluate only the transcript text.",
  "When userInputWasSpoken is true, respond naturally to the spoken answer while still asking for precise technical reasoning.",
  "Do not claim code passed tests unless actual execution evidence is included in the user input.",
  "Return valid JSON only. Do not wrap JSON in markdown.",
].join(" ");

export function buildInterviewerMessages(
  input: AIInterviewerInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: interviewerSystemPrompt,
    },
    {
      role: "user",
      content: [
        "Respond as the interviewer for the current PatternForge interview phase.",
        "Keep the response to 1-3 short paragraphs or questions.",
        "Prefer one concise follow-up question when the candidate needs to clarify or fill a reasoning gap.",
        "Use previousVoiceTurns, currentPhaseVoiceTurns, previousMessages, currentPhaseData, and codeExecution as interview context.",
        "If a transcript is unclear, incomplete, self-contradictory, or vague, ask a clarification question instead of assuming intent.",
        "If the candidate rambles or gives a very long unstructured answer, ask them to summarize the approach in 2-3 sentences.",
        "If the candidate jumps to implementation before a high-level plan, ask for the plan, data structures, and invariant first.",
        "If the candidate states a pattern without justification, ask why that pattern applies and what signal supports it.",
        "Encourage structured communication: assumptions, pattern signal, invariant, algorithm, edge cases, complexity.",
        "Point out skipped important reasoning, but keep the tone realistic and supportive.",
        "Ask for invariant, edge cases, or complexity when missing for the current phase.",
        "Use codeExecution to reference real run results, failures, and custom tests from PatternForge Code Workspace.",
        "If the candidate asks for a hint or says they are stuck, set hintLevel to the staged level you used.",
        "If the candidate does not ask for help, hintLevel must be null.",
        "The correctPattern and secondaryPatterns fields are internal interviewer context.",
        "If the current phase is before PatternHypothesis has been submitted and canRevealCorrectPattern is false, use the correct pattern only to shape questions; do not name, reveal, strongly imply, or contrast it.",
        "phaseSuggestion may suggest the next phase when the user's answer is sufficient; otherwise use null.",
        "concernFlags should be short machine-readable strings such as missing_constraints, pattern_revealed_risk, weak_edge_cases, incomplete_complexity, unexecuted_tests_claim, or code_not_run.",
        "Return JSON matching this TypeScript shape:",
        `{
  "interviewerMessage": string,
  "phaseSuggestion": "Setup" | "ClarifyingQuestions" | "PatternHypothesis" | "Approach" | "Implementation" | "Testing" | "Complexity" | "Feedback" | null,
  "hintLevel": 1 | 2 | 3 | 4 | 5 | null,
  "concernFlags": string[]
}`,
        "PatternForge interviewer input:",
        serializeInput(input),
      ].join("\n\n"),
    },
  ];
}

export function buildInterviewFeedbackMessages(
  input: AIInterviewFeedbackInput,
): AIPromptMessage[] {
  return [
    {
      role: "system",
      content: interviewerSystemPrompt,
    },
    {
      role: "user",
      content: [
        "Score this completed PatternForge interview from saved artifacts.",
        "You may use the correct pattern now because the interview is in Feedback.",
        "Scores must be integers from 0 to 100.",
        "Evaluate communication, pattern recognition, problem solving, implementation, testing, complexity, and time management when evidence is available.",
        "Do not claim code passed tests. State that code was not executed unless user supplied actual execution evidence.",
        "Return JSON matching this TypeScript shape:",
        `{
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "rubric": {
    "Communication"?: number,
    "PatternRecognition"?: number,
    "ProblemSolving"?: number,
    "Implementation"?: number,
    "Testing"?: number,
    "Complexity"?: number,
    "TimeManagement"?: number
  },
  "followUpRecommendations": string[]
}`,
        "PatternForge completed interview input:",
        serializeInput(input),
      ].join("\n\n"),
    },
  ];
}
