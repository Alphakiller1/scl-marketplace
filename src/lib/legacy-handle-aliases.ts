/**
 * Public slugs from the previous SCL site that no longer match User.username
 * after import (the extractor used `cappers.user`, which was often longer).
 *
 * Keep this list tiny and proven: a 404 on the old slug plus a live profile
 * on the new one. Do not guess.
 */
const LEGACY_HANDLE_ALIASES: Record<string, string> = {
  wgs: "wisegentlemensports",
};

export function resolveLegacyHandleAlias(handle: string): string {
  const bare = handle.replace(/^@+/, "").trim().toLowerCase();
  return LEGACY_HANDLE_ALIASES[bare] ?? handle.replace(/^@+/, "").trim();
}
