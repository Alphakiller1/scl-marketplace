import { UNIT_MIN } from "@/lib/constants";

/**
 * Public-surface eligibility helpers — exclude QA handles and invalid stakes
 * from leaderboard aggregates and public feeds without a schema migration.
 */

/**
 * Exact public handles that are staging/demo fixtures — never surface in
 * Discover, leaderboard, or other public directories.
 */
export const PUBLIC_EXCLUDED_HANDLES = [
  "demo_capper",
  "beetbot",
  "media",
  "ericlikestotest",
] as const;

function normalizeHandle(username: string): string {
  return username.replace(/^@+/, "").trim().toLowerCase();
}

/** True when the handle is a QA/test account (qa… / sclqa… prefixes or known fixtures). */
export function isTestHandle(username: string | null | undefined): boolean {
  if (!username) return false;
  const clean = normalizeHandle(username);
  if (/^(qa|sclqa)/i.test(clean)) return true;
  return (PUBLIC_EXCLUDED_HANDLES as readonly string[]).includes(clean);
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
        ...PUBLIC_EXCLUDED_HANDLES.map((handle) => ({
          username: { equals: handle, mode: "insensitive" as const },
        })),
      ],
    },
  };
}
