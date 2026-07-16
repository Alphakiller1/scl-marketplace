import "server-only";

import {
  hasClvColumns,
  hasNotesPublicColumn,
  hasOddsUsageDailyTable,
} from "@/lib/results/schema-features";

export type SchemaStatusReport = {
  notesPublic: boolean;
  clvColumns: boolean;
  oddsUsageDaily: boolean;
  allReady: boolean;
  patchDoc: "docs/qa/SUPABASE_SQL_PATCHES.md";
};

/** Authenticated readout of additive Supabase patches (Task E). */
export async function getSchemaStatusReport(): Promise<SchemaStatusReport> {
  const [notesPublic, clvColumns, oddsUsageDaily] = await Promise.all([
    hasNotesPublicColumn(),
    hasClvColumns(),
    hasOddsUsageDailyTable(),
  ]);
  return {
    notesPublic,
    clvColumns,
    oddsUsageDaily,
    allReady: notesPublic && clvColumns && oddsUsageDaily,
    patchDoc: "docs/qa/SUPABASE_SQL_PATCHES.md",
  };
}
