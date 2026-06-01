import { SignInButton } from "@clerk/nextjs";

import { AchievementToast } from "@/components/completion";
import { getAchievementCatalog } from "@/lib/achievements/service";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

function formatDate(dateValue: string | null): string {
  if (!dateValue) {
    return "Locked";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Earned";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AchievementsPage() {
  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    return <UnauthenticatedAchievementsPage />;
  }

  const achievements = await getAchievementCatalog(userProfile.id);
  const earnedAchievements = achievements.filter((achievement) => achievement.earnedAt);
  const lockedAchievements = achievements.filter((achievement) => !achievement.earnedAt);
  const totalXp = earnedAchievements.reduce(
    (total, achievement) => total + achievement.xpReward,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
            Achievements
          </p>
          <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
            Badges earned in the forge
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Earn badges by practicing consistently, reviewing memory work, and
            winning boss battles.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-teal-300">
            Badge progress
          </p>
          <p className="mt-3 text-4xl font-black">
            {earnedAchievements.length}/{achievements.length}
          </p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            {totalXp} achievement XP earned.
          </p>
        </div>
      </section>

      <AchievementGrid
        title="Earned badges"
        emptyText="No badges earned yet. Complete your first attempt to unlock First Forge."
        achievements={earnedAchievements}
      />

      <AchievementGrid
        title="Locked badges"
        emptyText="All badges earned."
        achievements={lockedAchievements}
      />
    </main>
  );
}

function AchievementGrid({
  title,
  emptyText,
  achievements,
}: {
  title: string;
  emptyText: string;
  achievements: Awaited<ReturnType<typeof getAchievementCatalog>>;
}) {
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
        {title}
      </p>

      {achievements.length === 0 ? (
        <p className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
          {emptyText}
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {achievements.map((achievement) =>
            achievement.earnedAt ? (
              <AchievementToast
                key={achievement.key}
                name={achievement.name}
                icon={achievement.icon}
                xpAmount={achievement.xpReward}
                description={`${achievement.description} Earned ${formatDate(
                  achievement.earnedAt,
                )}.`}
                nextActionLabel="Back to Dashboard"
                nextActionHref="/"
              />
            ) : (
              <div
                key={achievement.key}
                className="rounded-lg border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">
                    {achievement.icon}
                  </div>
                  <span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-black uppercase tracking-[0.14em] text-slate-600">
                    +{achievement.xpReward} XP
                  </span>
                </div>
                <h2 className="mt-4 text-xl font-black tracking-tight text-slate-950">
                  {achievement.name}
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                  {achievement.description}
                </p>
                <p className="mt-4 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  Locked
                </p>
              </div>
            ),
          )}
        </div>
      )}
    </section>
  );
}

function UnauthenticatedAchievementsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-teal-700">
          Achievements
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          Sign in to view badges
        </h1>
        <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
          Achievement progress is saved to your PatternForge account.
        </p>
        <SignInButton mode="modal">
          <button className="mt-5 rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700">
            Sign in
          </button>
        </SignInButton>
      </section>
    </main>
  );
}
