/**
 * Player-prop board helpers for the expanded-event Props section.
 * Keeps default chip count low (accordions collapsed) and makes any named
 * player reachable in ≤2 interactions (search / filter + expand or tap).
 */

/** Markets shown per player before "Show all (N)". */
export const PROP_MARKET_PREVIEW = 3;

/**
 * Compact pill labels for curated prop markets (board stores the full label as `market`).
 * Unknown markets fall back to the full label.
 */
const PROP_MARKET_SHORT: Record<string, string> = {
  Points: "Pts",
  Rebounds: "Reb",
  Assists: "Ast",
  "3-Pointers": "3PM",
  Strikeouts: "Ks",
  Outs: "Outs",
  "Earned Runs": "ER",
  Hits: "Hits",
  "Passing Yds": "Pass",
  "Rushing Yds": "Rush",
  Receptions: "Rec",
  "Receiving Yds": "Rec Yds",
  "Shots On Goal": "SOG",
};

export type PropSelection = {
  market: string;
  player?: string;
};

export type PlayerPropGroup<T extends PropSelection = PropSelection> = {
  player: string;
  /** Market label → selections for that player, sorted by market name. */
  markets: [string, T[]][];
};

export function propMarketShortLabel(market: string): string {
  return PROP_MARKET_SHORT[market] ?? market;
}

/** Distinct prop market labels present in the slate, alphabetical. */
export function availablePropMarkets(
  selections: readonly PropSelection[],
): string[] {
  const set = new Set<string>();
  for (const s of selections) {
    if (s.market) set.add(s.market);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Group prop selections by player, then by market (alphabetical). */
export function groupPropsByPlayer<T extends PropSelection>(
  selections: readonly T[],
): PlayerPropGroup<T>[] {
  const byPlayer = new Map<string, Map<string, T[]>>();
  for (const s of selections) {
    const player = (s.player ?? "").trim();
    if (!player) continue;
    let markets = byPlayer.get(player);
    if (!markets) {
      markets = new Map();
      byPlayer.set(player, markets);
    }
    const arr = markets.get(s.market);
    if (arr) arr.push(s);
    else markets.set(s.market, [s]);
  }

  return [...byPlayer.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([player, markets]) => ({
      player,
      markets: [...markets.entries()].sort(([a], [b]) => a.localeCompare(b)),
    }));
}

export function filterPlayerPropGroups<T extends PropSelection>(
  groups: readonly PlayerPropGroup<T>[],
  opts: { query?: string; market?: string | null },
): PlayerPropGroup<T>[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const market = opts.market?.trim() || null;

  return groups
    .map((g) => {
      const markets = market
        ? g.markets.filter(([m]) => m === market)
        : g.markets;
      if (!markets.length) return null;
      if (!q) return { player: g.player, markets };

      // Match player name, market label, or any selection/side string in the group.
      const playerHit = g.player.toLowerCase().includes(q);
      const filteredMarkets = markets
        .map(([m, opts]): [string, T[]] | null => {
          if (m.toLowerCase().includes(q)) return [m, opts];
          const hitOpts = opts.filter((s) => {
            const side =
              "side" in s && typeof s.side === "string" ? s.side : "";
            const selection =
              "selection" in s && typeof s.selection === "string"
                ? s.selection
                : "";
            return (
              side.toLowerCase().includes(q) ||
              selection.toLowerCase().includes(q)
            );
          });
          return hitOpts.length ? [m, hitOpts] : null;
        })
        .filter((entry): entry is [string, T[]] => entry !== null);

      if (playerHit) return { player: g.player, markets };
      if (!filteredMarkets.length) return null;
      return { player: g.player, markets: filteredMarkets };
    })
    .filter((g): g is PlayerPropGroup<T> => g !== null);
}

/** First N markets for the accordion preview; remainder count for "Show all". */
export function splitMarketPreview<T>(
  markets: readonly [string, T[]][],
  limit = PROP_MARKET_PREVIEW,
): { preview: [string, T[]][]; remaining: number } {
  if (markets.length <= limit) {
    return { preview: [...markets], remaining: 0 };
  }
  return {
    preview: markets.slice(0, limit) as [string, T[]][],
    remaining: markets.length - limit,
  };
}

/** Count price chips that would render for the given market groups. */
export function countPropChips<T>(markets: readonly [string, T[]][]): number {
  return markets.reduce((n, [, opts]) => n + opts.length, 0);
}
