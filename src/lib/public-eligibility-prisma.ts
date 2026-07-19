import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

/**
 * Public-query user filter for the migrated User.isTest publication gate.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries
 * so reserved ghost accounts can be enabled only in an explicit preview.
 */
export async function prismaExcludeTestHandlesLive() {
  const allowGhostAccounts =
    process.env.SCL_ALLOW_GHOST_PUBLICATION === "1" &&
    process.env.VERCEL_ENV !== "production";

  return prismaExcludeTestHandles({
    includeIsTestColumn: true,
    allowGhostAccounts,
  });
}
