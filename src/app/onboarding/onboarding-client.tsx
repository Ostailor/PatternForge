"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  CurrentLevel,
  PrimaryGoal,
} from "@/generated/prisma/enums";

import {
  completeOnboardingAction,
  skipOnboardingAction,
  trackOnboardingStartedAction,
} from "./actions";

type OnboardingChoice = {
  value: string;
  label: string;
  detail: string;
};

type OnboardingFormState = {
  primaryGoal: PrimaryGoal;
  currentLevel: CurrentLevel;
  dailyGoalMinutes: 10 | 25 | 45;
  voiceModeEnabled: boolean;
  diagnosticChoice: "take" | "skip";
};

const goalOptions: OnboardingChoice[] = [
  {
    value: PrimaryGoal.LearnPatterns,
    label: "Learning patterns from scratch",
    detail: "Start with recognition basics and short guided reps.",
  },
  {
    value: PrimaryGoal.PrepareForInternships,
    label: "Internship interviews",
    detail: "Build core pattern fluency for early-career interviews.",
  },
  {
    value: PrimaryGoal.PrepareForNewGrad,
    label: "New grad interviews",
    detail: "Balance recognition speed, implementation, and review.",
  },
  {
    value: PrimaryGoal.PrepareForBigTech,
    label: "Big Tech interviews",
    detail: "Prioritize mixed practice, pressure checks, and explanation.",
  },
  {
    value: PrimaryGoal.MaintainSkills,
    label: "Staying sharp",
    detail: "Keep memory fresh with shorter recurring sessions.",
  },
  {
    value: PrimaryGoal.ImproveInterviewCommunication,
    label: "Improving interview communication",
    detail: "Practice explaining patterns, complexity, and tradeoffs.",
  },
];

const levelOptions: OnboardingChoice[] = [
  {
    value: CurrentLevel.Beginner,
    label: "Beginner",
    detail: "I am still learning how these problems are structured.",
  },
  {
    value: CurrentLevel.SomeExperience,
    label: "Some experience",
    detail: "I have solved some problems but do not recognize patterns quickly.",
  },
  {
    value: CurrentLevel.InterviewPrep,
    label: "Currently interview prepping",
    detail: "I am practicing for interviews now and need focused reps.",
  },
  {
    value: CurrentLevel.Advanced,
    label: "Advanced",
    detail: "I want sharper recall, speed, and communication polish.",
  },
];

const practiceTimeOptions = [
  { value: 10, label: "10 minutes", detail: "Light daily maintenance." },
  { value: 25, label: "25 minutes", detail: "One focused practice block." },
  { value: 45, label: "45 minutes", detail: "Deeper reps with review." },
] as const;

const steps = [
  "Welcome",
  "Goal",
  "Experience",
  "Practice",
  "Diagnostic",
  "Finish",
] as const;

export default function OnboardingClient({
  initialPrimaryGoal,
  initialCurrentLevel,
  initialDailyGoalMinutes,
  initialVoiceModeEnabled,
}: {
  initialPrimaryGoal: PrimaryGoal;
  initialCurrentLevel: CurrentLevel;
  initialDailyGoalMinutes: number;
  initialVoiceModeEnabled: boolean;
}) {
  const trackedStart = useRef(false);
  const [activeStep, setActiveStep] = useState(0);
  const [formState, setFormState] = useState<OnboardingFormState>({
    primaryGoal: initialPrimaryGoal,
    currentLevel: initialCurrentLevel,
    dailyGoalMinutes:
      initialDailyGoalMinutes === 10 || initialDailyGoalMinutes === 45
        ? initialDailyGoalMinutes
        : 25,
    voiceModeEnabled: initialVoiceModeEnabled,
    diagnosticChoice: "take",
  });
  const progressPercent = Math.round(((activeStep + 1) / steps.length) * 100);
  const selectedGoal = useMemo(
    () =>
      goalOptions.find((option) => option.value === formState.primaryGoal) ??
      goalOptions[0],
    [formState.primaryGoal],
  );
  const selectedLevel = useMemo(
    () =>
      levelOptions.find((option) => option.value === formState.currentLevel) ??
      levelOptions[0],
    [formState.currentLevel],
  );

  useEffect(() => {
    if (trackedStart.current) {
      return;
    }

    trackedStart.current = true;
    void trackOnboardingStartedAction();
  }, []);

  function goNext() {
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function goBack() {
    setActiveStep((current) => Math.max(current - 1, 0));
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
                PatternForge setup
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Configure your first recommendation
              </h1>
            </div>
            <form action={skipOnboardingAction}>
              <button className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950">
                Skip setup
              </button>
            </form>
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              <span>{steps[activeStep]}</span>
              <span>
                {activeStep + 1}/{steps.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-teal-600 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        <form action={completeOnboardingAction} className="p-5 sm:p-6">
          <input type="hidden" name="primaryGoal" value={formState.primaryGoal} />
          <input type="hidden" name="currentLevel" value={formState.currentLevel} />
          <input
            type="hidden"
            name="dailyGoalMinutes"
            value={formState.dailyGoalMinutes}
          />
          <input type="hidden" name="preferredLanguage" value="Python" />
          <input
            type="hidden"
            name="voiceModeEnabled"
            value={String(formState.voiceModeEnabled)}
          />
          <input
            type="hidden"
            name="interviewerSpeechEnabled"
            value={String(formState.voiceModeEnabled)}
          />
          <input
            type="hidden"
            name="diagnosticChoice"
            value={formState.diagnosticChoice}
          />
          <input type="hidden" name="timezone" value="UTC" />

          {activeStep === 0 ? <WelcomeStep /> : null}
          {activeStep === 1 ? (
            <ChoiceStep
              eyebrow="Goal"
              title="What are you preparing for?"
              description="This shapes your goal record and the tone of your first recommendation."
              options={goalOptions}
              selectedValue={formState.primaryGoal}
              onSelect={(primaryGoal) =>
                setFormState((current) => ({
                  ...current,
                  primaryGoal: primaryGoal as PrimaryGoal,
                }))
              }
            />
          ) : null}
          {activeStep === 2 ? (
            <ChoiceStep
              eyebrow="Experience level"
              title="How comfortable are you with LeetCode-style problems?"
              description="Your level helps PatternForge choose how direct or advanced practice should feel."
              options={levelOptions}
              selectedValue={formState.currentLevel}
              onSelect={(currentLevel) =>
                setFormState((current) => ({
                  ...current,
                  currentLevel: currentLevel as CurrentLevel,
                }))
              }
            />
          ) : null}
          {activeStep === 3 ? (
            <PracticePreferencesStep
              dailyGoalMinutes={formState.dailyGoalMinutes}
              voiceModeEnabled={formState.voiceModeEnabled}
              onDailyGoalMinutesChange={(dailyGoalMinutes) =>
                setFormState((current) => ({ ...current, dailyGoalMinutes }))
              }
              onVoiceModeEnabledChange={(voiceModeEnabled) =>
                setFormState((current) => ({ ...current, voiceModeEnabled }))
              }
            />
          ) : null}
          {activeStep === 4 ? (
            <DiagnosticStep
              diagnosticChoice={formState.diagnosticChoice}
              onDiagnosticChoiceChange={(diagnosticChoice) =>
                setFormState((current) => ({ ...current, diagnosticChoice }))
              }
            />
          ) : null}
          {activeStep === 5 ? (
            <FinishStep
              selectedGoal={selectedGoal.label}
              selectedLevel={selectedLevel.label}
              dailyGoalMinutes={formState.dailyGoalMinutes}
              voiceModeEnabled={formState.voiceModeEnabled}
              diagnosticChoice={formState.diagnosticChoice}
            />
          ) : null}

          <div className="mt-8 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={goBack}
              disabled={activeStep === 0}
              className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Back
            </button>
            {activeStep < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700"
              >
                Continue
              </button>
            ) : (
              <button className="rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
                Finish setup
              </button>
            )}
          </div>
        </form>
      </section>
    </main>
  );
}

function WelcomeStep() {
  return (
    <section className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Welcome
        </p>
        <h2 className="mt-3 max-w-3xl text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
          PatternForge helps you recognize, remember, and master coding interview patterns.
        </h2>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Setup takes less than a minute. Your choices are private to your
          account and can be changed later as settings mature.
        </p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          First run
        </p>
        <div className="mt-5 grid gap-3">
          {["Goal", "Experience", "Practice", "Diagnostic"].map(
            (item, index) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
              >
                <span className="grid h-8 w-8 place-items-center rounded-md bg-teal-300 text-xs font-black text-slate-950">
                  {index + 1}
                </span>
                <span className="text-sm font-black text-slate-100">{item}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </section>
  );
}

function ChoiceStep({
  eyebrow,
  title,
  description,
  options,
  selectedValue,
  onSelect,
}: {
  eyebrow: string;
  title: string;
  description: string;
  options: OnboardingChoice[];
  selectedValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
        {description}
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={`rounded-lg border p-4 text-left transition ${
              selectedValue === option.value
                ? "border-teal-400 bg-teal-50 shadow-sm"
                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className="block text-base font-black text-slate-950">
              {option.label}
            </span>
            <span className="mt-1 block text-sm font-semibold leading-6 text-slate-600">
              {option.detail}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PracticePreferencesStep({
  dailyGoalMinutes,
  voiceModeEnabled,
  onDailyGoalMinutesChange,
  onVoiceModeEnabledChange,
}: {
  dailyGoalMinutes: 10 | 25 | 45;
  voiceModeEnabled: boolean;
  onDailyGoalMinutesChange: (value: 10 | 25 | 45) => void;
  onVoiceModeEnabledChange: (value: boolean) => void;
}) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Practice preferences
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Set your default practice rhythm
      </h2>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <p className="text-sm font-black text-slate-950">
            Preferred daily practice time
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {practiceTimeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onDailyGoalMinutesChange(option.value)}
                className={`rounded-lg border p-4 text-left transition ${
                  dailyGoalMinutes === option.value
                    ? "border-teal-400 bg-teal-50"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="block text-base font-black text-slate-950">
                  {option.label}
                </span>
                <span className="mt-1 block text-sm font-semibold leading-5 text-slate-600">
                  {option.detail}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-black text-slate-950">
            Preferred language
          </p>
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-base font-black text-slate-950">
              Python for now
            </p>
            <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
              PatternForge v0.9 keeps code workspace defaults aligned with the
              current runner.
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="text-base font-black text-slate-950">Voice mode</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {voiceModeEnabled ? "Enabled" : "Disabled"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onVoiceModeEnabledChange(!voiceModeEnabled)}
              className={`relative h-8 w-14 rounded-full transition ${
                voiceModeEnabled ? "bg-teal-600" : "bg-slate-300"
              }`}
              aria-pressed={voiceModeEnabled}
              aria-label="Toggle voice mode"
            >
              <span
                className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition ${
                  voiceModeEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiagnosticStep({
  diagnosticChoice,
  onDiagnosticChoiceChange,
}: {
  diagnosticChoice: "take" | "skip";
  onDiagnosticChoiceChange: (value: "take" | "skip") => void;
}) {
  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Diagnostic choice
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Take a 5-minute diagnostic?
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
        The diagnostic state is saved now, so PatternForge can route you into an
        assessment experience as that screen comes online.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => onDiagnosticChoiceChange("take")}
          className={`rounded-lg border p-5 text-left transition ${
            diagnosticChoice === "take"
              ? "border-teal-400 bg-teal-50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="block text-xl font-black text-slate-950">
            Take a 5-minute diagnostic
          </span>
          <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
            Save an in-progress diagnostic assessment and answer a few
            recognition questions.
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDiagnosticChoiceChange("skip")}
          className={`rounded-lg border p-5 text-left transition ${
            diagnosticChoice === "skip"
              ? "border-teal-400 bg-teal-50"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          <span className="block text-xl font-black text-slate-950">
            Skip and start with beginner plan
          </span>
          <span className="mt-2 block text-sm font-semibold leading-6 text-slate-600">
            Use the beginner recommendation path first and revisit diagnostics
            later.
          </span>
        </button>
      </div>
    </section>
  );
}

function FinishStep({
  selectedGoal,
  selectedLevel,
  dailyGoalMinutes,
  voiceModeEnabled,
  diagnosticChoice,
}: {
  selectedGoal: string;
  selectedLevel: string;
  dailyGoalMinutes: number;
  voiceModeEnabled: boolean;
  diagnosticChoice: "take" | "skip";
}) {
  const summary = [
    ["Goal", selectedGoal],
    ["Experience", selectedLevel],
    ["Daily practice", `${dailyGoalMinutes} minutes`],
    ["Language", "Python"],
    ["Voice mode", voiceModeEnabled ? "Enabled" : "Disabled"],
    [
      "Diagnostic",
      diagnosticChoice === "take"
        ? "Create diagnostic assessment"
        : "Start with beginner plan",
    ],
  ];

  return (
    <section>
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Finish
      </p>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Save your PatternForge setup
      </h2>
      <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
        Finishing updates your settings, creates an active goal, marks
        onboarding complete, and refreshes the dashboard.
      </p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {summary.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg border border-slate-200 bg-slate-50 p-4"
          >
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {label}
            </p>
            <p className="mt-2 text-base font-black text-slate-950">{value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
