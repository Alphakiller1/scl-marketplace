import "server-only";

import {
  PROP_MARKET_LABEL,
  VERIFY_REGIONS,
  VERIFY_TTL_SECONDS,
  bestAvailableAmerican,
  collectAvailablePrices,
  verificationMarkets,
  verifyOdds,
  type RawEventOdds,
  type VerifyResult,
} from "@/lib/odds-verify";

/**
 * The Odds API client (odds-assist + auto-grade). Reads ODDS_API_KEY at runtime;
 * every function degrades gracefully to empty when the key or sport isn't available,
 * so the app works with or without a key configured.
 *
 * SCL sport keys (NBA, MLB, …) differ from The Odds API's (basketball_nba, …), so all
 * translation lives here and is shared with the auto-grade results provider.
 */
const SCL_TO_ODDS_API: Record<string, string> = {
  NFL: "americanfootball_nfl",
  NBA: "basketball_nba",
  NCAAF: "americanfootball_ncaaf",
  NCAAB: "basketball_ncaab",
  MLB: "baseball_mlb",
  NHL: "icehockey_nhl",
  WNBA: "basketball_wnba",
  CFL: "americanfootball_cfl",
};

const ODDS_API_TO_SCL: Record<string, string> = Object.fromEntries(
  Object.entries(SCL_TO_ODDS_API).map(([scl, api]) => [api, scl]),
);

export function toOddsApiSport(sclKey: string): string | undefined {
  return SCL_TO_ODDS_API[sclKey];
}

/** The Odds API key. Accepts the canonical name and the common `ODD_API_KEY` misspelling. */
export function oddsApiKey(): string | undefined {
  return process.env.ODDS_API_KEY || process.env.ODD_API_KEY;
}

export function toSclSport(oddsApiKey: string): string | undefined {
  return ODDS_API_TO_SCL[oddsApiKey];
}

/** Sports we can odds-assist / auto-grade as game moneyline + totals. */
export function oddsAssistSupported(sclKey: string): boolean {
  return sclKey in SCL_TO_ODDS_API;
}

export type OddsSelection = {
  label: string; // display, e.g. "Boston Celtics ML"
  market: string; // prefill for the play's market field (game label or prop label)
  selection: string; // prefill for the play's selection field
  side: string; // structured side for verification: team, or "Over"/"Under" (C2)
  line?: number; // structured point/total for spreads + totals (C2)
  player?: string; // structured player for props (C2)
  oddsAmerican: number;
};

export type OddsEvent = {
  id: string;
  sport: string; // SCL key
  commenceTime: string;
  home: string;
  away: string;
  selections: OddsSelection[]; // moneyline + totals, ready to prefill an entry
};

type RawOutcome = { name: string; price: number; point?: number };
type RawMarket = { key: string; outcomes: RawOutcome[] };
type RawEvent = {
  id: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: { markets?: RawMarket[] }[];
};

function firstMarket(event: RawEvent, key: string): RawMarket | undefined {
  for (const bm of event.bookmakers ?? []) {
    const m = bm.markets?.find((mk) => mk.key === key);
    if (m) return m;
  }
  return undefined;
}

function normalize(sclSport: string, event: RawEvent): OddsEvent {
  const selections: OddsSelection[] = [];

  const h2h = firstMarket(event, "h2h");
  for (const o of h2h?.outcomes ?? []) {
    if (typeof o.price === "number") {
      selections.push({
        label: `${o.name} ML`,
        market: "Moneyline",
        selection: o.name,
        side: o.name,
        oddsAmerican: Math.round(o.price),
      });
    }
  }

  const spreads = firstMarket(event, "spreads");
  for (const o of spreads?.outcomes ?? []) {
    if (typeof o.price === "number" && typeof o.point === "number") {
      const line = `${o.point > 0 ? "+" : ""}${o.point}`;
      selections.push({
        label: `${o.name} ${line}`,
        market: "Spread",
        selection: `${o.name} ${line}`,
        side: o.name,
        line: o.point,
        oddsAmerican: Math.round(o.price),
      });
    }
  }

  const totals = firstMarket(event, "totals");
  for (const o of totals?.outcomes ?? []) {
    if (typeof o.price === "number" && typeof o.point === "number") {
      selections.push({
        label: `${o.name} ${o.point}`,
        market: "Total",
        selection: `${o.name} ${o.point}`,
        side: o.name,
        line: o.point,
        oddsAmerican: Math.round(o.price),
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

/** Upcoming games with moneyline + totals for a SCL sport. [] when no key/unsupported. */
export async function fetchUpcomingOdds(
  sclSport: string,
): Promise<OddsEvent[]> {
  const apiKey = oddsApiKey();
  const apiSport = toOddsApiSport(sclSport);
  if (!apiKey || !apiSport) return [];

  const url =
    `https://api.the-odds-api.com/v4/sports/${apiSport}/odds/` +
    `?apiKey=${apiKey}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`;

  try {
    const res = await fetch(url, { next: { revalidate: 120 } });
    if (!res.ok) return [];
    const events = (await res.json()) as RawEvent[];
    return (
      events
        .map((e) => normalize(sclSport, e))
        .filter((e) => e.selections.length > 0)
        // Keep enough of the soonest games that today + tomorrow's slate both fit for
        // daily sports; the board buckets them into Today/Tomorrow client-side.
        .slice(0, 60)
    );
  } catch {
    return [];
  }
}

// ── pick odds/line verification (docs/SCL_PICK_INTEGRITY.md §C3) ──────────────

/** Log Odds API credit usage from a response so burn is observable vs. the plan cap. */
function logOddsUsage(res: Response, label: string): void {
  const remaining = res.headers.get("x-requests-remaining");
  const last = res.headers.get("x-requests-last");
  if (remaining !== null || last !== null) {
    console.info(
      `[odds] ${label}: cost=${last ?? "?"} remaining=${remaining ?? "?"}`,
    );
  }
}

/**
 * One BUNDLED per-event odds call (featured + alternate + curated props), `regions=us`, cached
 * for VERIFY_TTL_SECONDS via Next's fetch data cache so picks on the same event within the window
 * share it (one credit spend, not one per pick). Returns null when no key / unsupported sport /
 * fetch fails — the caller then treats the pick as unverifiable (SELF-REPORTED), never rejected.
 */
export async function fetchEventOddsForVerification(
  sclSport: string,
  eventId: string,
): Promise<RawEventOdds | null> {
  const apiKey = oddsApiKey();
  const apiSport = toOddsApiSport(sclSport);
  if (!apiKey || !apiSport) return null;
  const markets = verificationMarkets(sclSport).join(",");
  const url =
    `https://api.the-odds-api.com/v4/sports/${apiSport}/events/${eventId}/odds/` +
    `?apiKey=${apiKey}&regions=${VERIFY_REGIONS}&markets=${markets}&oddsFormat=american`;
  try {
    const res = await fetch(url, {
      next: { revalidate: VERIFY_TTL_SECONDS, tags: [`odds-event:${eventId}`] },
    });
    logOddsUsage(res, `event ${eventId}`);
    if (!res.ok) return null;
    return (await res.json()) as RawEventOdds;
  } catch {
    return null;
  }
}

/**
 * Fetch + verify a claimed pick price against the live market (one-sided implied-prob bound).
 * `unverifiable` when the event/market can't be sourced (→ SELF-REPORTED); `verified`/`rejected`
 * otherwise. Grade at the capper's claimed price; rank on `reference` (see §C3).
 */
export async function verifyPick(params: {
  sclSport: string;
  eventId: string;
  marketKeys: string[];
  side: string;
  line?: number;
  player?: string;
  claimedAmerican: number;
  toleranceProb?: number;
}): Promise<VerifyResult> {
  const event = await fetchEventOddsForVerification(
    params.sclSport,
    params.eventId,
  );
  if (!event) {
    return {
      status: "unverifiable",
      reason: "Odds unavailable for this event.",
    };
  }
  const availableAmerican = collectAvailablePrices(event, {
    marketKeys: params.marketKeys,
    side: params.side,
    line: params.line,
    player: params.player,
  });
  return verifyOdds({
    claimedAmerican: params.claimedAmerican,
    availableAmerican,
    toleranceProb: params.toleranceProb,
  });
}

// ── expanded per-event board (game lines + alternate lines) ───────────────────

/** Odds API market keys we surface on the board, mapped to the SCL market label. */
const BOARD_MARKETS: Record<string, "Moneyline" | "Spread" | "Total"> = {
  h2h: "Moneyline",
  spreads: "Spread",
  alternate_spreads: "Spread",
  totals: "Total",
  alternate_totals: "Total",
};

// Game markets sort ahead of props; props (rank 10) then sort alphabetically by their label.
const MARKET_SORT = { Moneyline: 0, Spread: 1, Total: 2 } as const;
const PROP_RANK = 10;

type BoardGroup = {
  market: string; // game label ("Spread") or prop label ("Strikeouts")
  side: string;
  line?: number;
  player?: string;
  prices: number[];
};

function marketRank(market: string): number {
  return MARKET_SORT[market as keyof typeof MARKET_SORT] ?? PROP_RANK;
}

/**
 * Flatten a per-event odds payload into board selections spanning featured **and alternate** game
 * lines plus curated **player props**. Prices for the same { market, side, line, player } are
 * collapsed across books to the single most bettor-favorable number, so each row shows the best
 * line available. Props carry a `player`; their `market` is the human label (e.g. "Strikeouts"),
 * which verification maps back to its Odds API key. Pure.
 */
export function normalizeEventBoard(event: RawEventOdds): OddsSelection[] {
  const groups = new Map<string, BoardGroup>();

  const add = (key: string, seed: () => BoardGroup, price: number) => {
    const g = groups.get(key);
    if (g) g.prices.push(price);
    else {
      const next = seed();
      next.prices = [price];
      groups.set(key, next);
    }
  };

  for (const bm of event.bookmakers ?? []) {
    for (const m of bm.markets ?? []) {
      const gameMarket = BOARD_MARKETS[m.key];
      const propLabel = PROP_MARKET_LABEL[m.key];
      if (!gameMarket && !propLabel) continue;
      for (const o of m.outcomes ?? []) {
        if (typeof o.price !== "number") continue;
        const price = Math.round(o.price);
        const line = typeof o.point === "number" ? o.point : undefined;
        if (gameMarket) {
          if (gameMarket !== "Moneyline" && line === undefined) continue;
          add(
            `g|${gameMarket}|${o.name.toLowerCase()}|${line ?? ""}`,
            () => ({ market: gameMarket, side: o.name, line, prices: [] }),
            price,
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
              prices: [],
            }),
            price,
          );
        }
      }
    }
  }

  const selections: OddsSelection[] = [];
  for (const g of groups.values()) {
    const best = bestAvailableAmerican(g.prices);
    if (best === null) continue;
    if (g.player) {
      const text = `${g.player} ${g.side} ${g.line}`;
      selections.push({
        label: text,
        market: g.market,
        selection: text,
        side: g.side,
        line: g.line,
        player: g.player,
        oddsAmerican: best,
      });
    } else if (g.market === "Moneyline") {
      selections.push({
        label: `${g.side} ML`,
        market: "Moneyline",
        selection: g.side,
        side: g.side,
        oddsAmerican: best,
      });
    } else if (g.market === "Spread") {
      const signed = `${(g.line ?? 0) > 0 ? "+" : ""}${g.line}`;
      selections.push({
        label: `${g.side} ${signed}`,
        market: "Spread",
        selection: `${g.side} ${signed}`,
        side: g.side,
        line: g.line,
        oddsAmerican: best,
      });
    } else {
      selections.push({
        label: `${g.side} ${g.line}`,
        market: "Total",
        selection: `${g.side} ${g.line}`,
        side: g.side,
        line: g.line,
        oddsAmerican: best,
      });
    }
  }

  return selections.sort((a, b) => {
    const ra = marketRank(a.market);
    const rb = marketRank(b.market);
    if (ra !== rb) return ra - rb;
    // Props share rank 10 — group them by label; game markets have distinct ranks already.
    if (a.market !== b.market) return a.market.localeCompare(b.market);
    // Within a market: player ladder (props), then side ladder, then line.
    const pa = a.player ?? "";
    const pb = b.player ?? "";
    if (pa !== pb) return pa.localeCompare(pb);
    if (a.side !== b.side) return a.side.localeCompare(b.side);
    return (a.line ?? 0) - (b.line ?? 0);
  });
}

/**
 * The full board for one event — featured + alternate game lines — reusing the cached per-event
 * verification fetch, so browsing and verifying the same event share a single credit spend.
 * Returns [] when the event can't be sourced (no key / unsupported / fetch failure).
 */
export async function fetchEventBoard(
  sclSport: string,
  eventId: string,
): Promise<OddsSelection[]> {
  const event = await fetchEventOddsForVerification(sclSport, eventId);
  if (!event) return [];
  return normalizeEventBoard(event);
}
