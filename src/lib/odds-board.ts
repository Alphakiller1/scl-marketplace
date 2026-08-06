/**
 * Pure odds-board normalization + per-book attribution (M4 PR-2).
 * No network / no server-only — unit-testable. Fetch lives in odds-api.ts.
 */

import { isBookKey } from "@/lib/books";
import {
  PERIOD_MARKET_LABEL,
  parsePeriodMarket,
  segmentShortLabel,
} from "@/lib/period-markets";
import {
  impliedProbFromAmerican,
  propMarketLabel,
  type RawEventOdds,
} from "@/lib/odds-verify";

/** American ≥ this (longshot) or ≤ {@link EXTREME_AMERICAN_FAVORITE} → operator-review flag. */
export const EXTREME_AMERICAN_LONGSHOT = 900;
/** American ≤ this (heavy favorite) → operator-review flag. */
export const EXTREME_AMERICAN_FAVORITE = -2000;

/** True when an American price warrants quiet operator review (never auto-blocked). */
export function isExtremeAmericanOdds(american: number): boolean {
  return (
    american >= EXTREME_AMERICAN_LONGSHOT ||
    american <= EXTREME_AMERICAN_FAVORITE
  );
}

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
  /** Bookmaker `last_update` ISO keyed by book for active-book display. */
  bookCapturedAt?: Record<string, string>;
  /** Bookmaker `last_update` ISO for the displayed book, when the feed provides it. */
  oddsCapturedAt?: string;
};

export type OddsEvent = {
  id: string;
  sport: string;
  /** Soccer league key (EPL, MLS, …) when sport is SOCCER. */
  league?: string;
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
  lastUpdateByBook?: Map<string, string>,
): {
  price: number;
  book: string;
  bookPrices: Record<string, number>;
  bookCapturedAt?: Record<string, string>;
  capturedAt?: string;
} | null {
  const bookPrices = Object.fromEntries(byBook);
  const bookCapturedAt =
    lastUpdateByBook && lastUpdateByBook.size > 0
      ? Object.fromEntries(lastUpdateByBook)
      : undefined;
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
  const capturedAt = lastUpdateByBook?.get(best.book);
  return {
    price: best.price,
    book: best.book,
    bookPrices,
    ...(bookCapturedAt ? { bookCapturedAt } : {}),
    ...(capturedAt ? { capturedAt } : {}),
  };
}

/** Normalized matchup key for board dedupe (sport + home + away + commence). */
export function oddsEventMatchupKey(
  event: Pick<OddsEvent, "sport" | "home" | "away" | "commenceTime">,
): string {
  return [
    event.sport.trim().toLowerCase(),
    event.away.trim().toLowerCase(),
    event.home.trim().toLowerCase(),
    event.commenceTime.trim(),
  ].join("|");
}

function eventBoardCompleteness(event: OddsEvent): number {
  let bookSlots = 0;
  for (const s of event.selections) {
    bookSlots += Object.keys(s.bookPrices ?? {}).length;
  }
  return bookSlots * 1_000 + event.selections.length;
}

function eventBoardFreshness(event: OddsEvent): number {
  let freshest = Number.NEGATIVE_INFINITY;
  for (const selection of event.selections) {
    const capturedAt = [
      selection.oddsCapturedAt,
      ...Object.values(selection.bookCapturedAt ?? {}),
    ];
    for (const value of capturedAt) {
      if (!value) continue;
      const timestamp = Date.parse(value);
      if (Number.isFinite(timestamp)) freshest = Math.max(freshest, timestamp);
    }
  }
  return freshest;
}

/**
 * Collapse duplicate feed rows for the same matchup into one event.
 * Prefers the most-complete row, then the freshest row, then the later feed row.
 */
export function dedupeOddsEvents(events: readonly OddsEvent[]): OddsEvent[] {
  const bestByKey = new Map<string, OddsEvent>();
  const order: string[] = [];
  for (const event of events) {
    const key = oddsEventMatchupKey(event);
    const prev = bestByKey.get(key);
    if (!prev) {
      bestByKey.set(key, event);
      order.push(key);
      continue;
    }
    const completeness = eventBoardCompleteness(event);
    const previousCompleteness = eventBoardCompleteness(prev);
    if (
      completeness > previousCompleteness ||
      (completeness === previousCompleteness &&
        eventBoardFreshness(event) >= eventBoardFreshness(prev))
    ) {
      bestByKey.set(key, event);
    }
  }
  return order.map((key) => bestByKey.get(key)!);
}

const BOARD_MARKETS: Record<string, "Moneyline" | "Spread" | "Total"> = {
  h2h: "Moneyline",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Total",
  alternate_totals: "Total",
};

const MARKET_SORT = { Moneyline: 0, Spread: 1, Total: 2 } as const;
/** Period lines sit between the full-game block and props. */
const PERIOD_RANK = 5;
const PROP_RANK = 10;
const FEATURED_KEYS = new Set(["h2h", "spreads", "totals"]);

type BoardGroup = {
  market: string;
  side: string;
  line?: number;
  player?: string;
  featured: boolean;
  byBook: Map<string, number>;
  lastUpdateByBook: Map<string, string>;
};

function marketRank(market: string): number {
  const full = MARKET_SORT[market as keyof typeof MARKET_SORT];
  if (full !== undefined) return full;
  const period = parsePeriodMarket(market);
  if (!period) return PROP_RANK;
  // F3 before F5 before F7, moneyline/spread/total within each.
  const kindRank =
    period.kind === "moneyline" ? 0 : period.kind === "spread" ? 1 : 2;
  return PERIOD_RANK + period.innings / 10 + kindRank / 100;
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
    seed: () => Omit<BoardGroup, "byBook" | "lastUpdateByBook">,
    bookKey: string | undefined,
    price: number,
    featured: boolean,
    lastUpdate?: string,
  ) => {
    let g = groups.get(key);
    if (!g) {
      g = {
        ...seed(),
        byBook: new Map(),
        lastUpdateByBook: new Map(),
      };
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
      if (lastUpdate) g.lastUpdateByBook.set(bk, lastUpdate);
    }
  };

  for (const bm of event.bookmakers ?? []) {
    const bookKey = bm.key?.trim() || undefined;
    const lastUpdate =
      typeof bm.last_update === "string" ? bm.last_update : undefined;
    for (const m of bm.markets ?? []) {
      const gameMarket = BOARD_MARKETS[m.key];
      const periodLabel = PERIOD_MARKET_LABEL[m.key];
      const propLabel = propMarketLabel(m.key);
      if (!gameMarket && !periodLabel && !propLabel) continue;
      const isFeatured = FEATURED_KEYS.has(m.key);
      for (const o of m.outcomes ?? []) {
        if (typeof o.price !== "number") continue;
        const price = Math.round(o.price);
        const line = typeof o.point === "number" ? o.point : undefined;
        if (periodLabel) {
          // Spread/total segments need a line; the moneyline segment has none.
          // A 3-way book prices "Draw" here too — kept, since a tie is a real
          // first-N-innings result and grading settles it explicitly.
          const kind = parsePeriodMarket(periodLabel)?.kind;
          if (kind !== "moneyline" && line === undefined) continue;
          add(
            `q|${periodLabel}|${o.name.toLowerCase()}|${line ?? ""}`,
            () => ({
              market: periodLabel,
              side: o.name,
              line,
              featured: false,
            }),
            bookKey,
            price,
            false,
            lastUpdate,
          );
        } else if (gameMarket) {
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
            lastUpdate,
          );
        } else {
          if (!propLabel) continue;
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
            lastUpdate,
          );
        }
      }
    }
  }

  const selections: OddsSelection[] = [];
  for (const g of groups.values()) {
    const best = preferredThenAll(g.byBook, preferred, g.lastUpdateByBook);
    if (!best) continue;
    const book = best.book || undefined;
    const oddsCapturedAt = best.capturedAt;
    const period = g.player ? null : parsePeriodMarket(g.market);
    if (period) {
      // Selection text carries the segment as well as the market label, so the
      // record still reads as a period pick anywhere only the selection shows.
      const short = segmentShortLabel(g.market);
      const signed =
        g.line == null
          ? ""
          : period.kind === "spread"
            ? ` ${g.line > 0 ? "+" : ""}${g.line}`
            : ` ${g.line}`;
      const text = `${g.side}${signed} (${short})`;
      selections.push({
        label: text,
        market: g.market,
        selection: text,
        side: g.side,
        line: g.line,
        featured: false,
        oddsAmerican: best.price,
        book,
        bookPrices: best.bookPrices,
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
      });
    } else if (g.player) {
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
    last_update?: string;
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
  league?: string,
): OddsEvent {
  const groups = new Map<
    string,
    {
      market: "Moneyline" | "Spread" | "Total";
      side: string;
      line?: number;
      byBook: Map<string, number>;
      lastUpdateByBook: Map<string, string>;
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
    lastUpdate?: string,
  ) => {
    let g = groups.get(id);
    if (!g) {
      g = { ...seed, byBook: new Map(), lastUpdateByBook: new Map() };
      groups.set(id, g);
    }
    const bk = bookKey ?? "";
    const prev = g.byBook.get(bk);
    if (
      prev === undefined ||
      impliedProbFromAmerican(price) < impliedProbFromAmerican(prev)
    ) {
      g.byBook.set(bk, price);
      if (lastUpdate) g.lastUpdateByBook.set(bk, lastUpdate);
    }
  };

  for (const bm of event.bookmakers ?? []) {
    const bookKey = bm.key?.trim() || undefined;
    const lastUpdate =
      typeof bm.last_update === "string" ? bm.last_update : undefined;
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
            lastUpdate,
          );
        } else if (m.key === "spreads" && typeof o.point === "number") {
          touch(
            `sp|${o.name.toLowerCase()}|${o.point}`,
            { market: "Spread", side: o.name, line: o.point },
            bookKey,
            price,
            lastUpdate,
          );
        } else if (m.key === "totals" && typeof o.point === "number") {
          touch(
            `tot|${o.name.toLowerCase()}|${o.point}`,
            { market: "Total", side: o.name, line: o.point },
            bookKey,
            price,
            lastUpdate,
          );
        }
      }
    }
  }

  const selections: OddsSelection[] = [];
  for (const g of groups.values()) {
    const best = preferredThenAll(g.byBook, preferredBooks, g.lastUpdateByBook);
    if (!best) continue;
    const book = best.book || undefined;
    const oddsCapturedAt = best.capturedAt;
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
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
        ...(best.bookCapturedAt ? { bookCapturedAt: best.bookCapturedAt } : {}),
        ...(oddsCapturedAt ? { oddsCapturedAt } : {}),
      });
    }
  }

  return {
    id: event.id,
    sport: sclSport,
    league,
    commenceTime: event.commence_time,
    home: event.home_team,
    away: event.away_team,
    selections,
  };
}
