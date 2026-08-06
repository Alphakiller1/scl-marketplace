import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Postgres codes that mean the object genuinely is not there:
 * 42P01 undefined_table, 42703 undefined_column.
 *
 * Anything else — a statement timeout, a dropped pooler connection — says
 * nothing about the schema. Reporting those as "missing" sent a live
 * investigation after a nonexistent migration, so they are logged as what they
 * are.
 */
function describeProbeFailure(err: unknown, subject: string): string {
  const code =
    typeof err === "object" && err !== null && "meta" in err
      ? ((err as { meta?: { code?: string } }).meta?.code ?? "")
      : "";
  const message = err instanceof Error ? err.message : String(err);
  return code === "42P01" || code === "42703"
    ? `[schema] ${subject} missing — run docs/qa/SUPABASE_SQL_PATCHES.md: ${message}`
    : `[schema] ${subject} probe failed (transient, not a missing object): ${message}`;
}

let clvReady: boolean | null = null;
let notesPublicReady: boolean | null = null;
let oddsUsageReady: boolean | null = null;
let isTestReady: boolean | null = null;
let needsReviewReady: boolean | null = null;

/**
 * Detect additive columns/tables from SUPABASE_SQL_PATCHES.md.
 * Positive results are cached; negatives are re-probed so owner SQL
 * can take effect without waiting for a full redeploy/cold start.
 *
 * Every probe below is **schema-qualified** (`scl."X"`, never bare `"X"`).
 * Supabase's pooler runs transaction mode, so the `?schema=scl` search_path
 * Prisma sets at connection time is not guaranteed to be on the server
 * connection a given statement lands on. An unqualified probe therefore fails
 * with 42P01 intermittently even though the table exists — which is exactly how
 * `OddsUsageDaily` came to log "missing" one minute before a successful write
 * to it. Prisma's own generated SQL is always qualified; only hand-written raw
 * SQL is exposed to this.
 */
export async function hasClvColumns(): Promise<boolean> {
  if (clvReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "closingOddsAmerican", "clvPts" FROM scl."Play" WHERE false`;
    clvReady = true;
    return true;
  } catch (err) {
    clvReady = false;
    console.warn(describeProbeFailure(err, "CLV columns"));
    return false;
  }
}

export async function hasNotesPublicColumn(): Promise<boolean> {
  if (notesPublicReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "notesPublic" FROM scl."Play" WHERE false`;
    notesPublicReady = true;
    return true;
  } catch (err) {
    notesPublicReady = false;
    console.warn(describeProbeFailure(err, "notesPublic column"));
    return false;
  }
}

export async function hasIsTestColumn(): Promise<boolean> {
  if (isTestReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "isTest" FROM scl."User" WHERE false`;
    isTestReady = true;
    return true;
  } catch (err) {
    isTestReady = false;
    console.warn(describeProbeFailure(err, "User.isTest column"));
    return false;
  }
}

export async function hasNeedsReviewColumn(): Promise<boolean> {
  if (needsReviewReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "needsReview" FROM scl."Play" WHERE false`;
    needsReviewReady = true;
    return true;
  } catch (err) {
    needsReviewReady = false;
    console.warn(describeProbeFailure(err, "needsReview column"));
    return false;
  }
}

export async function hasOddsUsageDailyTable(): Promise<boolean> {
  if (oddsUsageReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT 1 FROM scl."OddsUsageDaily" WHERE false`;
    oddsUsageReady = true;
    return true;
  } catch (err) {
    oddsUsageReady = false;
    console.warn(describeProbeFailure(err, "OddsUsageDaily"));
    return false;
  }
}
