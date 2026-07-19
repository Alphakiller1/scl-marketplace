import { prismaExcludeTestHandles } from "@/lib/public-eligibility";
import { hasIsTestColumn } from "@/lib/results/schema-features";

/**
 * Public-query user filter with User.isTest soft-degrade.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries.
 */
export async function prismaExcludeTestHandlesLive() {
  const allowGhostAccounts =
    process.env.SCL_ALLOW_GHOST_PUBLICATION === "1" &&
    process.env.VERCEL_ENV !== "production";

  return prismaExcludeTestHandles({
    includeIsTestColumn: await hasIsTestColumn(),
    allowGhostAccounts,
  });
}
