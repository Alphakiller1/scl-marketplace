import "server-only";

import { prisma } from "@/lib/prisma";

let clvReady: boolean | null = null;
let notesPublicReady: boolean | null = null;
let oddsUsageReady: boolean | null = null;
let isTestReady: boolean | null = null;
let needsReviewReady: boolean | null = null;

/**
 * Detect additive columns/tables from SUPABASE_SQL_PATCHES.md.
 * Positive results are cached; negatives are re-probed so owner SQL
 * can take effect without waiting for a full redeploy/cold start.
 */
export async function hasClvColumns(): Promise<boolean> {
  if (clvReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "closingOddsAmerican", "clvPts" FROM "Play" WHERE false`;
    clvReady = true;
    return true;
  } catch (err) {
    clvReady = false;
    console.warn(
      "[schema] CLV columns missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function hasNotesPublicColumn(): Promise<boolean> {
  if (notesPublicReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "notesPublic" FROM "Play" WHERE false`;
    notesPublicReady = true;
    return true;
  } catch (err) {
    notesPublicReady = false;
    console.warn(
      "[schema] notesPublic column missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function hasIsTestColumn(): Promise<boolean> {
  if (isTestReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "isTest" FROM "User" WHERE false`;
    isTestReady = true;
    return true;
  } catch (err) {
    isTestReady = false;
    console.warn(
      "[schema] User.isTest column missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function hasNeedsReviewColumn(): Promise<boolean> {
  if (needsReviewReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT "needsReview" FROM "Play" WHERE false`;
    needsReviewReady = true;
    return true;
  } catch (err) {
    needsReviewReady = false;
    console.warn(
      "[schema] needsReview column missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export async function hasOddsUsageDailyTable(): Promise<boolean> {
  if (oddsUsageReady === true) return true;
  try {
    await prisma.$queryRaw`SELECT 1 FROM "OddsUsageDaily" WHERE false`;
    oddsUsageReady = true;
    return true;
  } catch (err) {
    oddsUsageReady = false;
    console.warn(
      "[schema] OddsUsageDaily missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
