import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import {
  CurrentLevel,
  PreferredSessionLength,
  PrimaryGoal,
} from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";
import { getVoicePrivacyNotice } from "@/lib/voice/voicePrivacy";

import {
  deleteAiReviewsAction,
  deleteAllVoiceTranscriptsAction,
  deleteCodeSubmissionsAction,
  resetLearningProgressAction,
  updateAiAndVoiceSettingsAction,
  updateProfilePreferencesAction,
} from "./actions";

const statusMessages: Record<string, string> = {
  "preferences-saved": "Profile preferences saved.",
  "privacy-saved": "AI and voice settings saved.",
  "voice-deleted": "Voice transcripts and transcript-derived feedback deleted.",
  "code-deleted": "Code submissions and code run history deleted.",
  "ai-deleted": "AI reviews deleted.",
  "progress-reset": "Learning progress reset.",
  "confirm-voice": 'Type "DELETE VOICE" before deleting voice transcripts.',
  "confirm-code": 'Type "DELETE CODE" before deleting code submissions.',
  "confirm-ai": 'Type "DELETE AI" before deleting AI reviews.',
  "confirm-reset": 'Type "RESET PROGRESS" before resetting learning progress.',
  signin: "Sign in required.",
};

const currentLevelLabels: Record<CurrentLevel, string> = {
  [CurrentLevel.Beginner]: "Beginner",
  [CurrentLevel.SomeExperience]: "Some experience",
  [CurrentLevel.InterviewPrep]: "Currently interview prepping",
  [CurrentLevel.Advanced]: "Advanced",
};

const primaryGoalLabels: Record<PrimaryGoal, string> = {
  [PrimaryGoal.LearnPatterns]: "Learning patterns from scratch",
  [PrimaryGoal.PrepareForInternships]: "Internship interviews",
  [PrimaryGoal.PrepareForNewGrad]: "New grad interviews",
  [PrimaryGoal.PrepareForBigTech]: "Big Tech interviews",
  [PrimaryGoal.MaintainSkills]: "Staying sharp",
  [PrimaryGoal.ImproveInterviewCommunication]: "Improving interview communication",
};

const sessionLengthLabels: Record<PreferredSessionLength, string> = {
  [PreferredSessionLength.Short10]: "Short: 10 minutes",
  [PreferredSessionLength.Medium25]: "Medium: 25 minutes",
  [PreferredSessionLength.Long45]: "Long: 45 minutes",
};

function formatDateInput(date: Date | null | undefined): string {
  if (!date) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function SettingsSelect({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
      >
        {children}
      </select>
    </label>
  );
}

function BooleanSelect({
  label,
  name,
  defaultValue,
  help,
}: {
  label: string;
  name: string;
  defaultValue: boolean;
  help?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black text-slate-950">{label}</span>
      <select
        name={name}
        defaultValue={String(defaultValue)}
        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
      >
        <option value="true">On</option>
        <option value="false">Off</option>
      </select>
      {help ? (
        <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
          {help}
        </span>
      ) : null}
    </label>
  );
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { isAuthenticated } = await auth();
  const { status } = await searchParams;

  if (!isAuthenticated) {
    return <UnauthenticatedSettingsPage />;
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedSettingsPage />;
  }

  const prisma = getPrisma();
  const [
    settings,
    voiceTurnCount,
    codeSubmissionCount,
    aiReviewCount,
    attemptCount,
  ] = await Promise.all([
    prisma.userSettings.findUnique({
      where: { userProfileId: userProfile.id },
    }),
    prisma.voiceTurn.count({
      where: {
        interviewSession: {
          userProfileId: userProfile.id,
        },
      },
    }),
    prisma.codeSubmission.count({
      where: { userProfileId: userProfile.id },
    }),
    prisma.aIReview.count({
      where: { userProfileId: userProfile.id },
    }),
    prisma.attempt.count({
      where: { userProfileId: userProfile.id },
    }),
  ]);
  const resolvedSettings = {
    preferredLanguage: settings?.preferredLanguage ?? "Python",
    dailyGoalMinutes: settings?.dailyGoalMinutes ?? 25,
    targetInterviewDate: settings?.targetInterviewDate ?? null,
    currentLevel: settings?.currentLevel ?? CurrentLevel.Beginner,
    primaryGoal: settings?.primaryGoal ?? PrimaryGoal.LearnPatterns,
    preferredSessionLength:
      settings?.preferredSessionLength ?? PreferredSessionLength.Medium25,
    voiceModeEnabled: settings?.voiceModeEnabled ?? false,
    interviewerSpeechEnabled: settings?.interviewerSpeechEnabled ?? false,
    storeVoiceTranscripts: settings?.storeVoiceTranscripts ?? true,
    storeRawAudio: settings?.storeRawAudio ?? false,
    analyticsOptOut: settings?.analyticsOptOut ?? false,
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-slate-950 p-6 text-white shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
          Settings & Privacy
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight sm:text-5xl">
          Control your PatternForge setup
        </h1>
        <p className="mt-4 max-w-3xl text-sm font-semibold leading-6 text-slate-300">
          Manage practice preferences, AI defaults, voice privacy, and
          account-scoped data controls.
        </p>
      </section>

      {status ? (
        <p className="mt-5 rounded-lg border border-teal-200 bg-teal-50 p-4 text-sm font-bold text-teal-800">
          {statusMessages[status] ?? "Settings updated."}
        </p>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <form
          action={updateProfilePreferencesAction}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            Profile / Preferences
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <SettingsSelect
              label="Preferred language"
              name="preferredLanguage"
              defaultValue={resolvedSettings.preferredLanguage}
            >
              <option value="Python">Python</option>
            </SettingsSelect>
            <label className="block">
              <span className="text-sm font-black text-slate-950">
                Daily goal minutes
              </span>
              <input
                type="number"
                min={5}
                max={180}
                name="dailyGoalMinutes"
                defaultValue={resolvedSettings.dailyGoalMinutes}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
              />
            </label>
            <label className="block">
              <span className="text-sm font-black text-slate-950">
                Target interview date
              </span>
              <input
                type="date"
                name="targetInterviewDate"
                defaultValue={formatDateInput(resolvedSettings.targetInterviewDate)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
              />
            </label>
            <SettingsSelect
              label="Current level"
              name="currentLevel"
              defaultValue={resolvedSettings.currentLevel}
            >
              {Object.values(CurrentLevel).map((level) => (
                <option key={level} value={level}>
                  {currentLevelLabels[level]}
                </option>
              ))}
            </SettingsSelect>
            <SettingsSelect
              label="Primary goal"
              name="primaryGoal"
              defaultValue={resolvedSettings.primaryGoal}
            >
              {Object.values(PrimaryGoal).map((goal) => (
                <option key={goal} value={goal}>
                  {primaryGoalLabels[goal]}
                </option>
              ))}
            </SettingsSelect>
            <SettingsSelect
              label="Preferred session length"
              name="preferredSessionLength"
              defaultValue={resolvedSettings.preferredSessionLength}
            >
              {Object.values(PreferredSessionLength).map((length) => (
                <option key={length} value={length}>
                  {sessionLengthLabels[length]}
                </option>
              ))}
            </SettingsSelect>
          </div>
          <button className="mt-5 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Save Preferences
          </button>
        </form>

        <form
          action={updateAiAndVoiceSettingsAction}
          className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
            AI Settings
          </p>
          <div className="mt-5 grid gap-4">
            <DisabledField
              label="AI Coach enabled"
              value="Enabled"
              detail="AI Coach can be used where review actions are available. Per-user disable is not modeled yet."
            />
            <DisabledField
              label="Hint mode preference"
              value="Five-level hint ladder"
              detail="Hints currently use PatternForge's fixed staged hint mode."
            />
            <DisabledField
              label="Interviewer style"
              value="Adaptive interviewer"
              detail="Interview style is currently determined by Interview Mode context."
            />
            <BooleanSelect
              label="Voice mode default"
              name="voiceModeEnabled"
              defaultValue={resolvedSettings.voiceModeEnabled}
            />
            <BooleanSelect
              label="Interviewer speech default"
              name="interviewerSpeechEnabled"
              defaultValue={resolvedSettings.interviewerSpeechEnabled}
            />
          </div>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
              Voice Privacy
            </p>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-600">
              {getVoicePrivacyNotice({
                storeAudio: resolvedSettings.storeRawAudio,
                storeTranscript: resolvedSettings.storeVoiceTranscripts,
                allowTranscriptDeletion: true,
              })}
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <BooleanSelect
                label="Store transcripts"
                name="storeVoiceTranscripts"
                defaultValue={resolvedSettings.storeVoiceTranscripts}
                help="Transcripts power communication feedback and can be deleted below."
              />
              <BooleanSelect
                label="Store raw audio"
                name="storeRawAudio"
                defaultValue={resolvedSettings.storeRawAudio}
                help="Raw audio storage is off by default. Current voice flows are transcript-first."
              />
              <label className="block md:col-span-2">
                <span className="text-sm font-black text-slate-950">
                  Product analytics
                </span>
                <select
                  name="analyticsOptOut"
                  defaultValue={String(resolvedSettings.analyticsOptOut)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
                >
                  <option value="false">
                    On: help improve PatternForge with private usage signals
                  </option>
                  <option value="true">Off: do not store product analytics</option>
                </select>
                <span className="mt-2 block text-xs font-semibold leading-5 text-slate-500">
                  Analytics stores event names, IDs, counts, and statuses only.
                  It does not store code, transcripts, prompts, or raw answers.
                </span>
              </label>
            </div>
            {voiceTurnCount > 0 ? (
              <Link
                href="/interviews/history"
                className="mt-4 inline-flex text-sm font-black text-teal-700 transition hover:text-slate-950"
              >
                View transcript history
              </Link>
            ) : (
              <p className="mt-4 text-sm font-semibold text-slate-500">
                No saved voice transcripts found.
              </p>
            )}
          </div>

          <button className="mt-5 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Save AI & Voice Settings
          </button>
        </form>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.92fr]">
        <DataControls
          voiceTurnCount={voiceTurnCount}
          codeSubmissionCount={codeSubmissionCount}
          aiReviewCount={aiReviewCount}
          attemptCount={attemptCount}
        />
        <NotificationsPlaceholder />
      </section>
    </main>
  );
}

function DisabledField({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-black text-slate-950">{label}</p>
      <p className="mt-2 text-sm font-bold text-slate-700">{value}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
        {detail}
      </p>
    </div>
  );
}

function DataControls({
  voiceTurnCount,
  codeSubmissionCount,
  aiReviewCount,
  attemptCount,
}: {
  voiceTurnCount: number;
  codeSubmissionCount: number;
  aiReviewCount: number;
  attemptCount: number;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Data Controls
      </p>
      <div className="mt-5 grid gap-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h2 className="text-lg font-black text-slate-950">Export my data</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            Downloads account-scoped practice, review, interview, code, voice,
            recommendation, and settings data as JSON without exposing internal
            database identifiers.
          </p>
          <Link
            href="/api/settings/export"
            className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700"
          >
            Export Data
          </Link>
        </div>

        <form
          action={deleteAllVoiceTranscriptsAction}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <h2 className="text-lg font-black text-slate-950">
            Delete voice transcripts
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            Deletes {voiceTurnCount} saved voice transcript turn
            {voiceTurnCount === 1 ? "" : "s"} plus transcript-derived
            communication feedback.
          </p>
          <input
            name="confirmation"
            placeholder="Type DELETE VOICE"
            className="mt-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
          />
          <button className="mt-3 rounded-lg bg-amber-700 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-800">
            Delete Voice Transcripts
          </button>
        </form>

        <form
          action={deleteCodeSubmissionsAction}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <h2 className="text-lg font-black text-slate-950">
            Delete code submissions
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            Deletes {codeSubmissionCount} saved code submission
            {codeSubmissionCount === 1 ? "" : "s"} and related run/debug history.
          </p>
          <input
            name="confirmation"
            placeholder="Type DELETE CODE"
            className="mt-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
          />
          <button className="mt-3 rounded-lg bg-amber-700 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-800">
            Delete Code Submissions
          </button>
        </form>

        <form
          action={deleteAiReviewsAction}
          className="rounded-lg border border-amber-200 bg-amber-50 p-4"
        >
          <h2 className="text-lg font-black text-slate-950">
            Delete AI reviews
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            Deletes {aiReviewCount} saved AI review
            {aiReviewCount === 1 ? "" : "s"}. Interview rounds keep their
            non-AI answers and scores where possible.
          </p>
          <input
            name="confirmation"
            placeholder="Type DELETE AI"
            className="mt-4 w-full rounded-lg border border-amber-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
          />
          <button className="mt-3 rounded-lg bg-amber-700 px-4 py-3 text-sm font-black text-white transition hover:bg-amber-800">
            Delete AI Reviews
          </button>
        </form>

        <form
          action={resetLearningProgressAction}
          className="rounded-lg border border-rose-200 bg-rose-50 p-4"
        >
          <h2 className="text-lg font-black text-slate-950">
            Reset learning progress
          </h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">
            Resets attempts, reviews, flashcards, mistakes, XP events,
            achievements, quests, battles, recommendations, diagnostics, and
            learning plans. Your account, profile, and settings are kept.
            Current attempts tracked: {attemptCount}.
          </p>
          <input
            name="confirmation"
            placeholder="Type RESET PROGRESS"
            className="mt-4 w-full rounded-lg border border-rose-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"
          />
          <button className="mt-3 rounded-lg bg-rose-700 px-4 py-3 text-sm font-black text-white transition hover:bg-rose-800">
            Reset Learning Progress
          </button>
        </form>

        <DisabledDangerControl
          title="Delete account data request"
          detail="Not implemented yet. v0.9 keeps full account deletion as a manual support request until an audited deletion workflow exists."
        />
      </div>
    </section>
  );
}

function DisabledDangerControl({
  title,
  detail,
}: {
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 opacity-75">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
        {detail}
      </p>
      <button
        disabled
        className="mt-4 cursor-not-allowed rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-400"
      >
        Not implemented yet
      </button>
    </div>
  );
}

function NotificationsPlaceholder() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
        Notifications
      </p>
      <div className="mt-5 grid gap-4">
        <DisabledField
          label="Daily review reminder"
          value="Not implemented yet"
          detail="No notification delivery system exists in v0.9."
        />
        <DisabledField
          label="Streak reminder"
          value="Not implemented yet"
          detail="PatternForge does not currently schedule reminder messages."
        />
      </div>
    </section>
  );
}

function UnauthenticatedSettingsPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-700">
          Settings & Privacy
        </p>
        <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950">
          Sign in to manage settings
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          PatternForge settings and privacy controls are scoped to your account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-6 rounded-lg bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
