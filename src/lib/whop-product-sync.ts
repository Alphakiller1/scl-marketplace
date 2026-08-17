import type { WhopProductListItem } from "@/lib/whop-api";

export type WhopProductSyncAction = "upsert" | "deactivate" | "skip";

export function isWhopProductSyncable(product: WhopProductListItem): boolean {
  return (
    product.visibility === "visible" || product.visibility === "quick_link"
  );
}

/**
 * Visible products can be imported or refreshed. A hidden product may only
 * affect a package that was already mapped, where it must take the SCL offer
 * down. It never creates a new hidden package.
 */
export function whopProductSyncAction(
  product: WhopProductListItem,
  hasExistingPackage: boolean,
): WhopProductSyncAction {
  if (isWhopProductSyncable(product)) return "upsert";
  return hasExistingPackage ? "deactivate" : "skip";
}
