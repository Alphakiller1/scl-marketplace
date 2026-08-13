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
 * The candidate competitions, from the live catalog.
 *
 * Keeps only in-season soccer competitions that price actual fixtures —
 * `has_outrights` entries are futures markets (title winner) with no game
 * lines, so fetching them spends credits and returns nothing bettable.
 * Registry leagues come first in registry order; everything else follows
 * alphabetically, so the budget goes to the majors when both are in season.
 *
 * NOTE: this is the CANDIDATE list, not the final slate. "In season" is much
 * weaker than "playing this week" — see {@link selectLeaguesWithFixtures},
 * which is what decides where the credits actually go.
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

/** What the free `/events` probe learned about one competition. */
export type LeagueFixtureWindow = {
  /** Fixtures kicking off inside the lookahead window. */
  upcoming: number;
  /** Epoch ms of the soonest of them, or null when there are none. */
  firstKickoffMs: number | null;
};

/**
 * The competitions to actually spend credits on — the ones playing soonest.
 *
 * "In season" is a far weaker claim than "playing this week", and the gap
 * between them is what emptied the soccer board. On 2026-08-13 the catalog
 * called 45 competitions in season, so the registry's prestige order handed
 * NINE of the ten paid slots to competitions with no fixture for days — EPL did
 * not kick off until 8/21, Serie A 8/22, Bundesliga 8/28, MLS and Liga MX 8/15
 * — while J-League (10 matches inside 48h), Ligue 2 (9), Bundesliga 2 (5),
 * Saudi (4), Libertadores and Sudamericana were never fetched at all. Cappers
 * saw a soccer tab that was essentially MLS fixtures three days out.
 *
 * Prestige is the wrong sort key for a board whose job is "what can I bet
 * today". Competitions with a fixture in the window come first, soonest kickoff
 * first; the registry survives only as the tiebreaker among equals and as the
 * filler when too few competitions are playing to use the budget.
 *
 * The ranking input is free: `/v4/sports/{key}/events` is not billed, so the
 * paid odds calls are aimed rather than guessed.
 */
export function selectLeaguesWithFixtures(
  leagues: readonly SoccerLeague[],
  windowByApiKey: ReadonlyMap<string, LeagueFixtureWindow>,
  limit: number = SOCCER_LEAGUE_LIMIT,
): SoccerLeague[] {
  const registryRank = new Map(
    SOCCER_LEAGUES.map((l, index) => [l.oddsApiKey, index]),
  );
  const rankOf = (l: SoccerLeague) =>
    registryRank.get(l.oddsApiKey) ?? Number.MAX_SAFE_INTEGER;

  const playing: SoccerLeague[] = [];
  const idle: SoccerLeague[] = [];
  for (const league of leagues) {
    const win = windowByApiKey.get(league.oddsApiKey);
    if (win && win.upcoming > 0 && win.firstKickoffMs != null) {
      playing.push(league);
    } else {
      idle.push(league);
    }
  }

  playing.sort((a, b) => {
    const aMs = windowByApiKey.get(a.oddsApiKey)!.firstKickoffMs!;
    const bMs = windowByApiKey.get(b.oddsApiKey)!.firstKickoffMs!;
    return aMs !== bMs ? aMs - bMs : rankOf(a) - rankOf(b);
  });

  // Idle competitions keep the registry's order, so when the tour is quiet the
  // leftover slots still go to the majors rather than to whatever sorted first.
  idle.sort((a, b) => rankOf(a) - rankOf(b));

  return [...playing, ...idle].slice(0, Math.max(0, limit));
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
