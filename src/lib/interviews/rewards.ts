import type { InterviewResult } from "@/generated/prisma/enums";

export type InterviewRewardRound = {
  selectedPatternId: string | null;
  correctPatternId: string;
  patternExplanation: string | null;
  approachText: string | null;
  codeText: string | null;
  testCasesText: string | null;
  complexityText: string | null;
};

export type InterviewRewardInput = {
  overallScore: number;
  testingScore: number;
  complexityScore: number;
  result: InterviewResult;
  rounds: InterviewRewardRound[];
  previousOverallScore: number | null;
};

export type InterviewXpBreakdown = {
  completedInterview: number;
  completedAllPhases: number;
  correctPatternRecognition: number;
  scoreAtLeast70: number;
  meaningfulTests: number;
  correctComplexity: number;
};

export type InterviewRewardSummary = {
  completedXp: number;
  strongResultXp: number;
  improvementXp: number;
  breakdown: InterviewXpBreakdown;
  strongResult: boolean;
  improvedBy: number | null;
  improvedByAtLeast20: boolean;
};

const COMPLETE_INTERVIEW_XP = 40;
const COMPLETE_ALL_PHASES_XP = 20;
const CORRECT_PATTERN_XP = 25;
const SCORE_70_XP = 25;
const SCORE_85_XP = 50;
const MEANINGFUL_TESTS_XP = 15;
const CORRECT_COMPLEXITY_XP = 15;

function hasMeaningfulText(value: string | null, minimumLength: number): boolean {
  return (value?.trim().replace(/\s+/g, " ").length ?? 0) >= minimumLength;
}

function completedAllPhases(rounds: InterviewRewardRound[]): boolean {
  return (
    rounds.length > 0 &&
    rounds.every(
      (round) =>
        round.selectedPatternId !== null &&
        hasMeaningfulText(round.patternExplanation, 20) &&
        hasMeaningfulText(round.approachText, 20) &&
        hasMeaningfulText(round.codeText, 10) &&
        hasMeaningfulText(round.testCasesText, 20) &&
        hasMeaningfulText(round.complexityText, 8),
    )
  );
}

function hasCorrectPatternRecognition(rounds: InterviewRewardRound[]): boolean {
  return rounds.some(
    (round) =>
      round.selectedPatternId !== null &&
      round.selectedPatternId === round.correctPatternId,
  );
}

function hasMeaningfulTestCases(rounds: InterviewRewardRound[]): boolean {
  return rounds.some((round) => hasMeaningfulText(round.testCasesText, 40));
}

function hasCorrectComplexity(input: InterviewRewardInput): boolean {
  return (
    input.complexityScore >= 75 &&
    input.rounds.some((round) => hasMeaningfulText(round.complexityText, 12))
  );
}

export function calculateInterviewRewards(
  input: InterviewRewardInput,
): InterviewRewardSummary {
  const breakdown: InterviewXpBreakdown = {
    completedInterview: COMPLETE_INTERVIEW_XP,
    completedAllPhases: completedAllPhases(input.rounds)
      ? COMPLETE_ALL_PHASES_XP
      : 0,
    correctPatternRecognition: hasCorrectPatternRecognition(input.rounds)
      ? CORRECT_PATTERN_XP
      : 0,
    scoreAtLeast70: input.overallScore >= 70 ? SCORE_70_XP : 0,
    meaningfulTests:
      input.testingScore >= 70 && hasMeaningfulTestCases(input.rounds)
        ? MEANINGFUL_TESTS_XP
        : 0,
    correctComplexity: hasCorrectComplexity(input) ? CORRECT_COMPLEXITY_XP : 0,
  };
  const completedXp = Object.values(breakdown).reduce(
    (total, xp) => total + xp,
    0,
  );
  const strongResult = input.overallScore >= 85;
  const improvedBy =
    typeof input.previousOverallScore === "number"
      ? input.overallScore - input.previousOverallScore
      : null;

  return {
    completedXp,
    strongResultXp: strongResult ? SCORE_85_XP : 0,
    improvementXp: 0,
    breakdown,
    strongResult,
    improvedBy,
    improvedByAtLeast20: typeof improvedBy === "number" && improvedBy >= 20,
  };
}
