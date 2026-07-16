import { UNIT_MIN } from "@/lib/constants";

/**
 * Public-surface eligibility helpers — exclude QA handles and invalid stakes
 * from leaderboard aggregates and public feeds without a schema migration.
 */

/** True when the handle is a QA/test account (qa* or sclqa*). */
export function isTestHandle(username: string | null | undefined): boolean {
  if (!username) return false;
  return /^(qa|sclqa)/i.test(username);
}

/** True when stake meets the public minimum (0.25U). */
export function isValidPublicStake(units: number): boolean {
  return units >= UNIT_MIN;
}

/** Prisma `user` filter fragment — excludes QA/test handles from public queries. */
export function prismaExcludeTestHandles() {
  return {
    NOT: {
      OR: [
        { username: { startsWith: "qa", mode: "insensitive" as const } },
        { username: { startsWith: "sclqa", mode: "insensitive" as const } },
      ],
    },
  };
}
