import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

/**
 * Public-query user filter for the migrated User.isTest publication gate.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries.
 *
 * When `SCL_ALLOW_GHOST_PUBLICATION=1`, reserved `@ghost.scl.demo` accounts are
 * included on public surfaces (including production — temporary demo populate).
 * Turn the env off and wipe ghosts when the founding roster is real enough.
 */
export async function prismaExcludeTestHandlesLive() {
  const allowGhostAccounts = process.env.SCL_ALLOW_GHOST_PUBLICATION === "1";

  return prismaExcludeTestHandles({
    includeIsTestColumn: true,
    allowGhostAccounts,
  });
}
