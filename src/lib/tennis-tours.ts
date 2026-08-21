/**
 * Tennis tournament selection for the board.
 *
 * Tennis has the same shape of problem as soccer, only sharper: there is no
 * single "tennis" sport key on The Odds API, just one key per tournament, and a
 * tournament lasts about a week. A hardcoded registry would therefore be stale
 * within days of being written — ATP Cincinnati is a live key in August and a
 * dead one in September, when the US Open takes its place.
 *
 * So there is no registry to maintain here. The Odds API `/v4/sports` catalog is
 * the source of truth: it reports which tournaments are in season right now,
 * costs nothing to call, and follows the tour around the calendar on its own.
 * This module only decides ordering and how many tournaments one refresh may
 * fetch.
 *
 * Pure — no network. The fetch lives in `odds-api.ts`.
 */
export type TennisTour = {
  key: string;
  label: string;
  oddsApiKey: string;
};

/**
 * How many tournaments one board refresh may fetch.
 *
 * Each costs 3 credits (h2h + spreads + totals x 1 region). Two or three
 * tournaments run concurrently in a normal week — the ATP and WTA halves of a
 * combined event, plus the odd 250 — so four covers a full week without
 * spending on the long tail of challengers.
 */
export const TENNIS_TOUR_LIMIT = 4;

/**
 * In-season tournaments to consider before ranking by fixtures.
 *
 * The paid fetch is still {@link TENNIS_TOUR_LIMIT}. This is the free catalog
 * pool — large enough that Cincinnati is not dropped just because the US Open
 * flipped `active` a week early.
 */
export const TENNIS_CANDIDATE_LIMIT = 16;

/**
 * Tours in priority order when more tournaments are in season than the budget
 * covers. ATP first, then WTA, then anything else the catalog names.
 */
const TOUR_PRIORITY = ["tennis_atp_", "tennis_wta_"] as const;

/** One row of the Odds API `/v4/sports` catalog (shared shape with soccer). */
export type OddsApiSportRow = {
  key?: string;
  group?: string;
  title?: string;
  active?: boolean;
  has_outrights?: boolean;
};

/** Stable SCL league tag for a tournament, e.g. `ATP_CINCINNATI_OPEN`. */
export function tennisTourKey(oddsApiKey: string): string {
  return oddsApiKey.replace(/^tennis_/, "").toUpperCase();
}

function priorityOf(apiKey: string): number {
  const idx = TOUR_PRIORITY.findIndex((p) => apiKey.startsWith(p));
  return idx === -1 ? TOUR_PRIORITY.length : idx;
}

/**
 * The tournaments to fetch, from the live catalog.
 *
 * Keeps only in-season tournaments that price actual matches — `has_outrights`
 * entries are futures (tournament winner) with no match lines, so fetching them
 * spends credits and returns nothing a capper can log.
 */
export function selectTennisTours(
  catalog: readonly OddsApiSportRow[],
  limit: number = TENNIS_TOUR_LIMIT,
): TennisTour[] {
  const seen = new Set<string>();
  const tours: TennisTour[] = [];

  for (const row of catalog) {
    const apiKey = row.key?.trim();
    if (!apiKey || seen.has(apiKey)) continue;
    if (row.group?.trim().toLowerCase() !== "tennis") continue;
    if (row.active === false || row.has_outrights === true) continue;
    seen.add(apiKey);

    tours.push({
      key: tennisTourKey(apiKey),
      label: row.title?.trim() || tennisTourKey(apiKey),
      oddsApiKey: apiKey,
    });
  }

  tours.sort((a, b) => {
    const byTour = priorityOf(a.oddsApiKey) - priorityOf(b.oddsApiKey);
    return byTour !== 0 ? byTour : a.label.localeCompare(b.label);
  });

  return tours.slice(0, Math.max(0, limit));
}

/** What the free `/events` probe learned about one tournament. */
export type TennisFixtureWindow = {
  upcoming: number;
  firstKickoffMs: number | null;
};

/**
 * Spend the paid tennis slots on tournaments that actually have matches.
 *
 * `active` on the catalog is weaker than "playing this week". During the
 * Cincinnati → US Open overlap the US Open is already in-season, and a hard
 * slice of four ATP-first keys can keep the listed slam and drop the Masters
 * that is on court today. Same ranking soccer already uses: soonest day,
 * then match volume, then ATP before WTA.
 */
export function selectTennisToursWithFixtures(
  tours: readonly TennisTour[],
  windowByApiKey: ReadonlyMap<string, TennisFixtureWindow>,
  limit: number = TENNIS_TOUR_LIMIT,
  now: number = Date.now(),
): TennisTour[] {
  const playing: TennisTour[] = [];
  const idle: TennisTour[] = [];
  for (const tour of tours) {
    const win = windowByApiKey.get(tour.oddsApiKey);
    if (win && win.upcoming > 0 && win.firstKickoffMs != null) {
      playing.push(tour);
    } else {
      idle.push(tour);
    }
  }

  const dayOf = (tour: TennisTour) =>
    Math.floor(
      (windowByApiKey.get(tour.oddsApiKey)!.firstKickoffMs! - now) / 86_400_000,
    );
  const tourRank = (a: TennisTour, b: TennisTour) => {
    const byTour = priorityOf(a.oddsApiKey) - priorityOf(b.oddsApiKey);
    return byTour !== 0 ? byTour : a.label.localeCompare(b.label);
  };

  playing.sort((a, b) => {
    const dayDiff = dayOf(a) - dayOf(b);
    if (dayDiff !== 0) return dayDiff;
    const volDiff =
      windowByApiKey.get(b.oddsApiKey)!.upcoming -
      windowByApiKey.get(a.oddsApiKey)!.upcoming;
    if (volDiff !== 0) return volDiff;
    return tourRank(a, b);
  });
  idle.sort(tourRank);

  return [...playing, ...idle].slice(0, Math.max(0, limit));
}

/**
 * Look up a tournament by SCL league tag.
 *
 * Every tour is discovered from the catalog, so this reverses
 * {@link tennisTourKey} rather than consulting a list: a pick logged during
 * Cincinnati must still resolve back to its sport key at verification time,
 * weeks after the tour has moved on and the catalog no longer names it.
 */
export function tennisTourByKey(key: string): TennisTour | undefined {
  const trimmed = key?.trim();
  if (!trimmed) return undefined;
  if (!/^[A-Z0-9_]+$/.test(trimmed)) return undefined;
  return {
    key: trimmed,
    label: trimmed,
    oddsApiKey: `tennis_${trimmed.toLowerCase()}`,
  };
}
