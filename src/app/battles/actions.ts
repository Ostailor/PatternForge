"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  generateMixedBattle,
  generatePatternBoss,
  generateReviewGauntlet,
} from "@/lib/battles/generateBattle";
import { AnalyticsEvents } from "@/lib/analytics-events/events";
import { trackEvent } from "@/lib/analytics-events/trackEvent";
import { canStartPatternBoss } from "@/lib/battles/dashboard";
import { getFeatureFlag } from "@/lib/feature-flags/getFeatureFlag";
import { getPrisma } from "@/lib/prisma";
import { ensureCurrentUserProfile } from "@/lib/user-profile";

const STARTER_PATTERN_ID = "arrays-hashing";

function battleRedirect(params: Record<string, string>): never {
  const searchParams = new URLSearchParams(params);

  redirect(`/battles?${searchParams.toString()}`);
}

function redirectToBattle(battleId: string): never {
  redirect(`/battles/${battleId}`);
}

function readPatternId(formData: FormData): string {
  const patternId = formData.get("patternId");

  return typeof patternId === "string" ? patternId.trim() : "";
}

async function getExistingActiveBattleId(userProfileId: string) {
  const activeBattle = await getPrisma().battle.findFirst({
    where: {
      userProfileId,
      status: "Active",
    },
    select: {
      id: true,
    },
    orderBy: {
      startedAt: "desc",
    },
  });

  return activeBattle?.id ?? null;
}

async function getPatternProblemCount(patternId: string) {
  return getPrisma().problem.count({
    where: {
      problemPatterns: {
        some: {
          patternId,
          isPrimary: true,
        },
      },
    },
  });
}

export async function startPatternBossAction(formData: FormData) {
  if (!getFeatureFlag("bossBattles")) {
    battleRedirect({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    battleRedirect({ error: "signin" });
  }

  const activeBattleId = await getExistingActiveBattleId(userProfile.id);

  if (activeBattleId) {
    redirectToBattle(activeBattleId);
  }

  const requestedPatternId = readPatternId(formData) || STARTER_PATTERN_ID;
  const problemCount = await getPatternProblemCount(requestedPatternId);

  if (!canStartPatternBoss(problemCount)) {
    battleRedirect({ error: "unavailable" });
  }

  try {
    const battle = await generatePatternBoss(userProfile.id, requestedPatternId);

    await trackEvent({
      eventName: AnalyticsEvents.BattleStarted,
      userProfileId: userProfile.id,
      properties: {
        battleId: battle.id,
        battleType: battle.battleType,
        targetPatternId: requestedPatternId,
        totalRounds: battle.totalRounds,
      },
    });

    revalidatePath("/battles");
    redirectToBattle(battle.id);
  } catch {
    battleRedirect({ error: "unavailable" });
  }
}

export async function startMixedBattleAction() {
  if (!getFeatureFlag("bossBattles")) {
    battleRedirect({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    battleRedirect({ error: "signin" });
  }

  const activeBattleId = await getExistingActiveBattleId(userProfile.id);

  if (activeBattleId) {
    redirectToBattle(activeBattleId);
  }

  try {
    const battle = await generateMixedBattle(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.BattleStarted,
      userProfileId: userProfile.id,
      properties: {
        battleId: battle.id,
        battleType: battle.battleType,
        totalRounds: battle.totalRounds,
      },
    });

    revalidatePath("/battles");
    redirectToBattle(battle.id);
  } catch {
    battleRedirect({ error: "unavailable" });
  }
}

export async function startReviewGauntletAction() {
  if (!getFeatureFlag("bossBattles")) {
    battleRedirect({ error: "disabled" });
  }

  const userProfile = await ensureCurrentUserProfile();

  if (!userProfile) {
    battleRedirect({ error: "signin" });
  }

  const activeBattleId = await getExistingActiveBattleId(userProfile.id);

  if (activeBattleId) {
    redirectToBattle(activeBattleId);
  }

  try {
    const battle = await generateReviewGauntlet(userProfile.id);

    await trackEvent({
      eventName: AnalyticsEvents.BattleStarted,
      userProfileId: userProfile.id,
      properties: {
        battleId: battle.id,
        battleType: battle.battleType,
        totalRounds: battle.totalRounds,
      },
    });

    revalidatePath("/battles");
    redirectToBattle(battle.id);
  } catch {
    battleRedirect({ error: "unavailable" });
  }
}
