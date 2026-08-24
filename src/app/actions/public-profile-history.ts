"use server";

import {
  getPublicProfileHistoryPage,
  type PublicProfileHistoryPage,
} from "@/lib/queries/capper";

/** Public, bounded cursor page used by the inspectable profile ledger. */
export async function loadPublicProfileHistory(
  handle: string,
  cursor: string,
): Promise<PublicProfileHistoryPage> {
  const normalizedHandle = handle.replace(/^@+/, "").trim();
  if (!normalizedHandle || !cursor) return { entries: [], nextCursor: null };
  return getPublicProfileHistoryPage(normalizedHandle, cursor);
}
