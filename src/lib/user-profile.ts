import { auth, currentUser } from "@clerk/nextjs/server";

import { getPrisma } from "@/lib/prisma";

export async function getCurrentAuthUserId(): Promise<string | null> {
  const { isAuthenticated, userId } = await auth();

  return isAuthenticated ? userId : null;
}

export async function ensureCurrentUserProfile() {
  const authUserId = await getCurrentAuthUserId();

  if (!authUserId) {
    return null;
  }

  const prisma = getPrisma();
  const user = await currentUser();
  const displayName =
    user?.fullName ??
    user?.username ??
    user?.primaryEmailAddress?.emailAddress ??
    "PatternForge User";

  return prisma.userProfile.upsert({
    where: { authUserId },
    update: {},
    create: {
      authUserId,
      displayName,
    },
  });
}
