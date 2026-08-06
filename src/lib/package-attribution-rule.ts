/**
 * The pick → package rule, kept free of `server-only` so it can be tested
 * directly (the runner cannot load that module).
 *
 * Selecting nothing means "this one is for everybody", not "this one is for
 * nobody". An unattributed pick vanishes from every package's evidence, so a
 * capper who never opened the package picker would build a storefront full of
 * empty records while posting daily. Empty selection therefore fans out across
 * the whole storefront.
 */
export function attributionForSelection(
  selected: readonly string[],
  allLivePackageIds: readonly string[],
): string[] {
  return selected.length > 0 ? [...selected] : [...allLivePackageIds];
}
