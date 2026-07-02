import "server-only";

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
  const apiKey = process.env.ODDS_API_KEY;
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
