/**
 * Pure odds-board normalization + per-book attribution (M4 PR-2).
 * No network / no server-only — unit-testable. Fetch lives in odds-api.ts.
 */

import { isBookKey } from "@/lib/books";
import {
  PROP_MARKET_LABEL,
  impliedProbFromAmerican,
  type RawEventOdds,
} from "@/lib/odds-verify";

export type OddsSelection = {
  label: string;
  market: string;
  selection: string;
  side: string;
  line?: number;
  player?: string;
  featured?: boolean;
  oddsAmerican: number;
  /** Odds API bookmaker key for the displayed (best) price. */
  book?: string;
  /** Per-book American prices; missing key → honest null via {@link getOddsForBook}. */
  bookPrices?: Record<string, number>;
};

export type OddsEvent = {
  id: string;
  sport: string;
  commenceTime: string;
  home: string;
  away: string;
  selections: OddsSelection[];
};

export type OddsBoardOpts = {
  /** CapperProfile.books — empty/omitted prefers all books on the payload. */
  books?: readonly string[];
};

/**
 * Honest price for one book on a board selection, or null when that book has no line
 * (UI renders "—"; never substitutes another book's price).
 */
export function getOddsForBook(
  selection: Pick<OddsSelection, "bookPrices">,
  bookKey: string,
): number | null {
  const p = selection.bookPrices?.[bookKey];
  return typeof p === "number" ? p : null;
}

/** Prefer selected books' prices; if none, fall back to the full set (never empty a row). */
export function preferredThenAll(
  byBook: Map<string, number>,
  preferred: readonly string[] | undefined,
): { price: number; book: string; bookPrices: Record<string, number> } | null {
  const bookPrices = Object.fromEntries(byBook);
  if (byBook.size === 0) return null;

  const preferredKeys = (preferred ?? []).filter(isBookKey);
  let entries: { book: string; price: number }[] = [];
  if (preferredKeys.length > 0) {
    for (const k of preferredKeys) {
      const price = byBook.get(k);
      if (typeof price === "number") entries.push({ book: k, price });
    }
  }
  if (entries.length === 0) {
    entries = [...byBook.entries()].map(([book, price]) => ({ book, price }));
  }
  if (entries.length === 0) return null;

  let best = entries[0]!;
  let bestImplied = impliedProbFromAmerican(best.price);
  for (const e of entries.slice(1)) {
    const implied = impliedProbFromAmerican(e.price);
    if (implied < bestImplied) {
      best = e;
      bestImplied = implied;
    }
  }
  return { price: best.price, book: best.book, bookPrices };
}

const BOARD_MARKETS: Record<string, "Moneyline" | "Spread" | "Total"> = {
  h2h: "Moneyline",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Total",
  alternate_totals: "Total",
};

const MARKET_SORT = { Moneyline: 0, Spread: 1, Total: 2 } as const;
const PROP_RANK = 10;
const FEATURED_KEYS = new Set(["h2h", "spreads", "totals"]);

type BoardGroup = {
  market: string;
  side: string;
  line?: number;
  player?: string;
  featured: boolean;
  byBook: Map<string, number>;
};

function marketRank(market: string): number {
  return MARKET_SORT[market as keyof typeof MARKET_SORT] ?? PROP_RANK;
}

/**
 * Flatten a per-event odds payload into board selections with per-book attribution.
 * Displayed price = best among preferred books; falls back to remaining books when none
 * of the preferred set has a line. Pure.
 */
export function normalizeEventBoard(
  event: RawEventOdds,
  opts?: OddsBoardOpts,
): OddsSelection[] {
  const groups = new Map<string, BoardGroup>();
  const preferred = opts?.books;

  const add = (
    key: string,
    seed: () => Omit<BoardGroup, "byBook">,
    bookKey: string | undefined,
    price: number,
    featured: boolean,
  ) => {
    let g = groups.get(key);
    if (!g) {
      g = { ...seed(), byBook: new Map() };
      groups.set(key, g);
    }
    if (featured) g.featured = true;
    const bk = bookKey ?? "";
    const prev = g.byBook.get(bk);
    if (
      prev === undefined ||
      impliedProbFromAmerican(price) < impliedProbFromAmerican(prev)
    ) {
      g.byBook.set(bk, price);
    }
  };

  for (const bm of event.bookmakers ?? []) {
    const bookKey = bm.key?.trim() || undefined;
    for (const m of bm.markets ?? []) {
      const gameMarket = BOARD_MARKETS[m.key];
      const propLabel = PROP_MARKET_LABEL[m.key];
      if (!gameMarket && !propLabel) continue;
      const isFeatured = FEATURED_KEYS.has(m.key);
      for (const o of m.outcomes ?? []) {
        if (typeof o.price !== "number") continue;
        const price = Math.round(o.price);
        const line = typeof o.point === "number" ? o.point : undefined;
        if (gameMarket) {
          if (gameMarket !== "Moneyline" && line === undefined) continue;
          add(
            `g|${gameMarket}|${o.name.toLowerCase()}|${line ?? ""}`,
            () => ({
              market: gameMarket,
              side: o.name,
              line,
              featured: false,
            }),
            bookKey,
            price,
            isFeatured,
          );
        } else {
          const player = (o.description ?? "").trim();
          if (!player || line === undefined) continue;
          add(
            `p|${propLabel}|${player.toLowerCase()}|${o.name.toLowerCase()}|${line}`,
            () => ({
              market: propLabel,
              side: o.name,
              line,
              player,
              featured: false,
            }),
            bookKey,
            price,
            false,
          );
        }
      }
    }
  }

  const selections: OddsSelection[] = [];
  for (const g of groups.values()) {
    const best = preferredThenAll(g.byBook, preferred);
    if (!best) continue;
    const book = best.book || undefined;
    if (g.player) {
      const text = `${g.player} ${g.side} ${g.line}`;
      selections.push({
        label: text,
        market: g.market,
        selection: text,
        side: g.side,
        line: g.line,
        player: g.player,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    } else if (g.market === "Moneyline") {
      selections.push({
        label: `${g.side} ML`,
        market: "Moneyline",
        selection: g.side,
        side: g.side,
        featured: true,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    } else if (g.market === "Spread") {
      const signed = `${(g.line ?? 0) > 0 ? "+" : ""}${g.line}`;
      selections.push({
        label: `${g.side} ${signed}`,
        market: "Spread",
        selection: `${g.side} ${signed}`,
        side: g.side,
        line: g.line,
        featured: g.featured,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    } else {
      selections.push({
        label: `${g.side} ${g.line}`,
        market: "Total",
        selection: `${g.side} ${g.line}`,
        side: g.side,
        line: g.line,
        featured: g.featured,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    }
  }

  return selections.sort((a, b) => {
    const ra = marketRank(a.market);
    const rb = marketRank(b.market);
    if (ra !== rb) return ra - rb;
    if (a.market !== b.market) return a.market.localeCompare(b.market);
    const pa = a.player ?? "";
    const pb = b.player ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    if (a.side !== b.side) return a.side.localeCompare(b.side);
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

type RawUpcoming = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: {
    key?: string;
    markets?: {
      key: string;
      outcomes: { name: string; price: number; point?: number }[];
    }[];
  }[];
};

/** Featured moneyline / spread / total rows for the upcoming slate. Pure. */
export function normalizeUpcomingEvent(
  sclSport: string,
  event: RawUpcoming,
  preferredBooks?: readonly string[],
): OddsEvent {
  const groups = new Map<
    string,
    {
      market: "Moneyline" | "Spread" | "Total";
      side: string;
      line?: number;
      byBook: Map<string, number>;
    }
  >();

  const touch = (
    id: string,
    seed: {
      market: "Moneyline" | "Spread" | "Total";
      side: string;
      line?: number;
    },
    bookKey: string | undefined,
    price: number,
  ) => {
    let g = groups.get(id);
    if (!g) {
      g = { ...seed, byBook: new Map() };
      groups.set(id, g);
    }
    const bk = bookKey ?? "";
    const prev = g.byBook.get(bk);
    if (
      prev === undefined ||
      impliedProbFromAmerican(price) < impliedProbFromAmerican(prev)
    ) {
      g.byBook.set(bk, price);
    }
  };

  for (const bm of event.bookmakers ?? []) {
    const bookKey = bm.key?.trim() || undefined;
    for (const m of bm.markets ?? []) {
      for (const o of m.outcomes ?? []) {
        if (typeof o.price !== "number") continue;
        const price = Math.round(o.price);
        if (m.key === "h2h") {
          touch(
            `ml|${o.name.toLowerCase()}`,
            { market: "Moneyline", side: o.name },
            bookKey,
            price,
          );
        } else if (m.key === "spreads" && typeof o.point === "number") {
          touch(
            `sp|${o.name.toLowerCase()}|${o.point}`,
            { market: "Spread", side: o.name, line: o.point },
            bookKey,
            price,
          );
        } else if (m.key === "totals" && typeof o.point === "number") {
          touch(
            `tot|${o.name.toLowerCase()}|${o.point}`,
            { market: "Total", side: o.name, line: o.point },
            bookKey,
            price,
          );
        }
      }
    }
  }

  const selections: OddsSelection[] = [];
  for (const g of groups.values()) {
    const best = preferredThenAll(g.byBook, preferredBooks);
    if (!best) continue;
    const book = best.book || undefined;
    if (g.market === "Moneyline") {
      selections.push({
        label: `${g.side} ML`,
        market: "Moneyline",
        selection: g.side,
        side: g.side,
        featured: true,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    } else if (g.market === "Spread") {
      const signed = `${(g.line ?? 0) > 0 ? "+" : ""}${g.line}`;
      selections.push({
        label: `${g.side} ${signed}`,
        market: "Spread",
        selection: `${g.side} ${signed}`,
        side: g.side,
        line: g.line,
        featured: true,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    } else {
      selections.push({
        label: `${g.side} ${g.line}`,
        market: "Total",
        selection: `${g.side} ${g.line}`,
        side: g.side,
        line: g.line,
        featured: true,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
      });
    }
  }

  return {
    id: event.id,
    sport: sclSport,
    commenceTime: event.commence_time,
    home: event.home_team,
    away: event.away_team,
    selections,
  };
}
