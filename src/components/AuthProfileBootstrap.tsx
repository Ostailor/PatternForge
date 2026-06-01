import { ensureCurrentUserProfile } from "@/lib/user-profile";

export default async function AuthProfileBootstrap() {
  await ensureCurrentUserProfile();

  return null;
}
