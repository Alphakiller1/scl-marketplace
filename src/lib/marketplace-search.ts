export type PublicMarketplaceCapper = {
  id: string;
  handle: string;
  name: string;
  avatarUrl: string | null;
};

export function findMarketplaceCapperMatches(
  query: string,
  cappers: PublicMarketplaceCapper[],
  packageCapperIds: ReadonlySet<string>,
  limit = 8,
): PublicMarketplaceCapper[] {
  const normalized = query.trim().toLowerCase().replace(/^@/, "");
  if (!normalized) return [];

  return cappers
    .filter((capper) => !packageCapperIds.has(capper.id))
    .filter((capper) =>
      [capper.handle.replace(/^@/, ""), capper.name].some((value) =>
        value.toLowerCase().includes(normalized),
      ),
    )
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .slice(0, limit);
}
