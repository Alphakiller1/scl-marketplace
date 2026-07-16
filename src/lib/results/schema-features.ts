import "server-only";

import { prisma } from "@/lib/prisma";

let clvReady: boolean | null = null;
let notesPublicReady: boolean | null = null;
let oddsUsageReady: boolean | null = null;

/**
 * Detect additive columns/tables from SUPABASE_SQL_PATCHES.md.
 * Cached per process so missing SQL does not 500 every cron tick.
 */
export async function hasClvColumns(): Promise<boolean> {
  if (clvReady != null) return clvReady;
  try {
    await prisma.$queryRaw`SELECT "closingOddsAmerican", "clvPts" FROM "Play" WHERE false`;
    clvReady = true;
  } catch (err) {
    clvReady = false;
    console.warn(
      "[schema] CLV columns missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
  }
  return clvReady;
}

export async function hasNotesPublicColumn(): Promise<boolean> {
  if (notesPublicReady != null) return notesPublicReady;
  try {
    await prisma.$queryRaw`SELECT "notesPublic" FROM "Play" WHERE false`;
    notesPublicReady = true;
  } catch (err) {
    notesPublicReady = false;
    console.warn(
      "[schema] notesPublic column missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
  }
  return notesPublicReady;
}

export async function hasOddsUsageDailyTable(): Promise<boolean> {
  if (oddsUsageReady != null) return oddsUsageReady;
  try {
    await prisma.$queryRaw`SELECT 1 FROM "OddsUsageDaily" WHERE false`;
    oddsUsageReady = true;
  } catch (err) {
    oddsUsageReady = false;
    console.warn(
      "[schema] OddsUsageDaily missing — run docs/qa/SUPABASE_SQL_PATCHES.md",
      err instanceof Error ? err.message : err,
    );
  }
  return oddsUsageReady;
}
