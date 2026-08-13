/**
 * Soccer league selection for the board.
 *
 * Soccer is the one sport with no single season: something is in play
 * year-round, but no fixed list of leagues is in season year-round. A hardcoded
 * registry is therefore guaranteed to be wrong for part of every year — in
 * early August SEVEN of the nine leagues below are between seasons (the big
 * five European leagues start mid-to-late August, UEFA in September), which
 * left the board reading "no soccer anywhere" while the code was working
 * exactly as written.
 *
 * So the list is no longer the source of truth. The Odds API `/v4/sports`
 * catalog is: it reports which competitions are actually in season right now,
 * costs nothing to call, and keeps SCL correct across every season rollover
 * without anyone editing this file. The registry below survives only to give
 * the majors nice labels and first claim on the per-refresh budget.
 *
 * Pure — no network. The fetch lives in `odds-api.ts`.
 */
export type SoccerLeague = {
  key: string;
  label: string;
  oddsApiKey: string;
};

/**
 * Preferred competitions, in priority order.
 *
 * Being here does NOT put a league on the board — the catalog decides that.
 * It buys a curated label and a place at the front of the queue when more
 * competitions are in season than the budget covers.
 */
export const SOCCER_LEAGUES: readonly SoccerLeague[] = [
  { key: "EPL", label: "EPL", oddsApiKey: "soccer_epl" },
  { key: "LA_LIGA", label: "La Liga", oddsApiKey: "soccer_spain_la_liga" },
  { key: "SERIE_A", label: "Serie A", oddsApiKey: "soccer_italy_serie_a" },
  {
    key: "BUNDESLIGA",
    label: "Bundesliga",
    oddsApiKey: "soccer_germany_bundesliga",
  },
  { key: "LIGUE_1", label: "Ligue 1", oddsApiKey: "soccer_france_ligue_one" },
  { key: "MLS", label: "MLS", oddsApiKey: "soccer_usa_mls" },
  {
    key: "UCL",
    label: "UEFA Champions League",
    oddsApiKey: "soccer_uefa_champs_league",
  },
  // The qualifying rounds are a SEPARATE sport key that is live exactly when
  // the group stage is not — through August, while `soccer_uefa_champs_league`
  // reports itself out of season and returns nothing. Ranked here, above the
  // domestic leagues, because in mid-August it is the only UEFA football being
  // priced at all. Note the Europa and Conference League qualifiers have no
  // equivalent key: The Odds API does not carry them, so those ties cannot
  // reach the board no matter how the budget is spent.
  {
    key: "UCL_QUAL",
    label: "UEFA Champions League Qualification",
    oddsApiKey: "soccer_uefa_champs_league_qualification",
  },
  {
    key: "EUROPA",
    label: "UEFA Europa League",
    oddsApiKey: "soccer_uefa_europa_league",
  },
  { key: "LIGA_MX", label: "Liga MX", oddsApiKey: "soccer_mexico_ligamx" },
  // In season through the northern summer, when the European leagues are not.
  // These are exactly the competitions whose absence made August look broken.
  {
    key: "BRAZIL_SERIE_A",
    label: "Brasileirão",
    oddsApiKey: "soccer_brazil_campeonato",
  },
  {
    key: "ARGENTINA_PRIMERA",
    label: "Liga Profesional",
    oddsApiKey: "soccer_argentina_primera_division",
  },
  {
    key: "EFL_CHAMPIONSHIP",
    label: "EFL Championship",
    oddsApiKey: "soccer_efl_champ",
  },
  {
    key: "EREDIVISIE",
    label: "Eredivisie",
    oddsApiKey: "soccer_netherlands_eredivisie",
  },
  {
    key: "PRIMEIRA_LIGA",
    label: "Primeira Liga",
    oddsApiKey: "soccer_portugal_primeira_liga",
  },
] as const;

/**
 * How many competitions one board refresh may fetch.
 *
 * Each costs ~3 credits (3 markets x 1 region) against a 20,000/month plan, and
 * the burn is real: an out-of-season league used to return nothing and cost
 * nothing, so selecting only LIVE competitions makes every call billable. Ten
 * in-season leagues is broader coverage than the old list of fifteen mostly-
 * dormant ones, and the widened board cache absorbs the difference.
 */
export const SOCCER_LEAGUE_LIMIT = 10;

/** One row of the Odds API `/v4/sports` catalog. */
export type OddsApiSportRow = {
  key?: string;
  group?: string;
  title?: string;
  active?: boolean;
  has_outrights?: boolean;
};

const byApiKey = new Map(SOCCER_LEAGUES.map((l) => [l.oddsApiKey, l]));

/** Stable SCL key for a competition the registry doesn't name. */
function derivedKey(apiKey: string): string {
  return apiKey.replace(/^soccer_/, "").toUpperCase();
}

/**
 * The competitions to fetch, from the live catalog.
 *
 * Keeps only in-season soccer competitions that price actual fixtures —
 * `has_outrights` entries are futures markets (title winner) with no game
 * lines, so fetching them spends credits and returns nothing bettable.
 * Registry leagues come first in registry order; everything else follows
 * alphabetically, so the budget goes to the majors when both are in season.
 */
export function selectSoccerLeagues(
  catalog: readonly OddsApiSportRow[],
  limit: number = SOCCER_LEAGUE_LIMIT,
): SoccerLeague[] {
  const seen = new Set<string>();
  const known: SoccerLeague[] = [];
  const extra: SoccerLeague[] = [];

  for (const row of catalog) {
    const apiKey = row.key?.trim();
    if (!apiKey || seen.has(apiKey)) continue;
    if (row.group?.trim().toLowerCase() !== "soccer") continue;
    if (row.active === false || row.has_outrights === true) continue;
    seen.add(apiKey);

    const registered = byApiKey.get(apiKey);
    if (registered) {
      known.push(registered);
    } else {
      extra.push({
        key: derivedKey(apiKey),
        label: row.title?.trim() || derivedKey(apiKey),
        oddsApiKey: apiKey,
      });
    }
  }

  known.sort(
    (a, b) =>
      SOCCER_LEAGUES.findIndex((l) => l.oddsApiKey === a.oddsApiKey) -
      SOCCER_LEAGUES.findIndex((l) => l.oddsApiKey === b.oddsApiKey),
  );
  extra.sort((a, b) => a.label.localeCompare(b.label));

  return [...known, ...extra].slice(0, Math.max(0, limit));
}

/**
 * Look up a league by SCL key.
 *
 * Also resolves competitions discovered from the catalog, whose keys are
 * derived from the API key — a pick logged against one must still resolve back
 * to its sport key at verification time, long after the board moved on.
 */
export function soccerLeagueByKey(key: string): SoccerLeague | undefined {
  const registered = SOCCER_LEAGUES.find((l) => l.key === key);
  if (registered) return registered;

  const trimmed = key?.trim();
  if (!trimmed) return undefined;
  if (/^[A-Z0-9_]+$/.test(trimmed)) {
    const apiKey = `soccer_${trimmed.toLowerCase()}`;
    return { key: trimmed, label: trimmed, oddsApiKey: apiKey };
  }
  return undefined;
}
