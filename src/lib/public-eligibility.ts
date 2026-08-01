import { UNIT_MIN } from "@/lib/constants";

/**
 * Public-surface eligibility helpers — exclude QA handles and invalid stakes
 * from leaderboard aggregates and public feeds without a schema migration.
 */

/**
 * Exact public handles that are staging/demo fixtures — never surface in
 * Discover, leaderboard, or other public directories. Prefer toggling User.isTest
 * in Supabase once that column exists; this list remains a belt-and-suspenders
 * backstop for known fixtures.
 */
export const PUBLIC_EXCLUDED_HANDLES = [
  "demo_capper",
  "beetbot",
  "media",
  "ericlikestotest",
  // Registered during 2026-07-14 post-submit receipt QA — its record is
  // All-Star/QA fixtures (one play literally noted "DISPOSABLE QA TEST"),
  // so it must never rank or surface publicly. Not a genuine capper.
  "solpickz",
] as const;

/** Email suffixes reserved for synthetic datasets. */
export const PUBLIC_EXCLUDED_EMAIL_SUFFIXES = ["@ghost.scl.demo"] as const;

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

/** True when an account belongs to a reserved QA/demo email namespace. */
export function isTestEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const clean = email.trim().toLowerCase();
  return (PUBLIC_EXCLUDED_EMAIL_SUFFIXES as readonly string[]).some((suffix) =>
    clean.endsWith(suffix),
  );
}

/**
 * Publication exclusion for a user row — `isTest` column wins when present;
 * handle-prefix / fixture list remain as belt-and-suspenders.
 */
export function isExcludedFromPublicPublication(user: {
  username?: string | null;
  email?: string | null;
  isTest?: boolean | null;
}): boolean {
  if (user.isTest === true) return true;
  return isTestHandle(user.username) || isTestEmail(user.email);
}

/** True when stake meets the public minimum (0.25U). */
export function isValidPublicStake(units: number): boolean {
  return units >= UNIT_MIN;
}

/**
 * QA/test markers that must never reach a public surface via a play's
 * free-text note. Kept tight to avoid false positives on genuine analysis
 * (e.g. "disposable income", "test the waters") — anchored to the exact
 * fixtures QA leaves behind.
 */
export const PUBLIC_QA_NOTE_PHRASES = [
  "qa test",
  "qatest",
  "disposable qa",
  "qa fixture",
  "do not publish",
  "test receipt",
] as const;

const QA_NOTE_MARKER =
  /\bqa\s*test\b|disposable\s*qa|\bqa\s*fixture\b|do not publish|\btest receipt\b/i;

/**
 * True when a play's note carries a QA/test marker. Such plays are dropped
 * from public feeds AND from leaderboard/record aggregates so a stray QA note
 * can never surface or inflate a record — the capper's private dashboard still
 * shows the note. Content-level analog of {@link isTestHandle}.
 */
export function hasQaNoteMarker(notes: string | null | undefined): boolean {
  if (!notes) return false;
  return QA_NOTE_MARKER.test(notes);
}

type PrismaExcludeOpts = {
  /**
   * When true (User.isTest column live), also require `isTest: false`.
   * Soft-degrade when the column is missing — handle guards still apply.
   */
  includeIsTestColumn?: boolean;
  /**
   * Permit reserved ghost-domain accounts (temporary demo populate).
   * Live queries enable this only when `SCL_ALLOW_GHOST_PUBLICATION=1`.
   * Known QA handles remain excluded.
   */
  allowGhostAccounts?: boolean;
};

/** Prisma `user` filter fragment — excludes QA/test handles from public queries. */
export function prismaExcludeTestHandles(opts?: PrismaExcludeOpts) {
  const allowGhostAccounts = opts?.allowGhostAccounts === true;
  const handleGuard = {
    NOT: {
      OR: [
        { username: { startsWith: "qa", mode: "insensitive" as const } },
        { username: { startsWith: "sclqa", mode: "insensitive" as const } },
        ...PUBLIC_EXCLUDED_HANDLES.map((handle) => ({
          username: { equals: handle, mode: "insensitive" as const },
        })),
        ...(allowGhostAccounts
          ? []
          : PUBLIC_EXCLUDED_EMAIL_SUFFIXES.map((suffix) => ({
              email: { endsWith: suffix, mode: "insensitive" as const },
            }))),
      ],
    },
  };

  if (!opts?.includeIsTestColumn) return handleGuard;

  return {
    AND: [
      allowGhostAccounts
        ? {
            OR: [
              { isTest: false },
              ...PUBLIC_EXCLUDED_EMAIL_SUFFIXES.map((suffix) => ({
                email: { endsWith: suffix, mode: "insensitive" as const },
              })),
            ],
          }
        : { isTest: false },
      handleGuard,
    ],
  };
}
