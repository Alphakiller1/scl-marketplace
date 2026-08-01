import { prismaExcludeTestHandles } from "@/lib/public-eligibility";

/**
 * Public-query user filter for the migrated User.isTest publication gate.
 * Prefer this over the pure {@link prismaExcludeTestHandles} in server queries.
 *
 * Temporary founding-roster populate: reserved `@ghost.scl.demo` accounts are
 * excluded from public surfaces unless `SCL_ALLOW_GHOST_PUBLICATION=1`.
 *
 * Opt-in, not opt-out. This defaulted to publishing them, so any environment
 * that had not explicitly set the flag to "0" would show fabricated cappers on
 * a board labelled verified — the failure mode was silent and public. Now a
 * misconfigured environment shows too little rather than something untrue, and
 * the real roster has replaced them regardless.
 */
export async function prismaExcludeTestHandlesLive() {
  const allowGhostAccounts = process.env.SCL_ALLOW_GHOST_PUBLICATION === "1";

  return prismaExcludeTestHandles({
    includeIsTestColumn: true,
    allowGhostAccounts,
  });
}
