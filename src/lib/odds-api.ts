import "server-only";

import {
  VERIFY_REGIONS,
  VERIFY_TTL_SECONDS,
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
  market: string; // prefill for the play's market field
  selection: string; // prefill for the play's selection field
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
    return events
      .map((e) => normalize(sclSport, e))
      .filter((e) => e.selections.length > 0)
      .slice(0, 30);
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
