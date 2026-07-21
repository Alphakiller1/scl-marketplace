import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

/**
 * Public-query user filter for the migrated User.isTest publication gate.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries.
 *
 * Temporary founding-roster populate: reserved `@ghost.scl.demo` accounts are
 * included on public surfaces unless `SCL_ALLOW_GHOST_PUBLICATION=0`.
 * Seed prod with `GHOST_SEED=1 GHOST_SEED_FORCE=1 npm run seed:ghosts`.
 * Set the env to `0` and wipe ghosts when the real roster is enough.
 */
export async function prismaExcludeTestHandlesLive() {
  const allowGhostAccounts = process.env.SCL_ALLOW_GHOST_PUBLICATION !== "0";

  return prismaExcludeTestHandles({
    includeIsTestColumn: true,
    allowGhostAccounts,
  });
}
