/**
 * Manual odds population — surface boards for every sport, plus expanded
 * per-event markets for the sports that have them: alternate lines, team
 * totals, innings segments and the full pitcher/hitter prop card for MLB, the
 * same shape plus halves for WNBA, the full-match ladder for tennis, and
 * Double Chance for soccer. Football is surface-level odds only.
 *
 * Runs on a fixed credit budget: it reports `x-requests-remaining` after every
 * call and stops at BUDGET_FLOOR rather than fetching a slate it cannot afford.
 * Expanded MLB is ~58 credits PER EVENT, so a fifteen-game card costs more than
 * a 500-credit key holds — which is why spending is ordered and reserved rather
 * than first-come:
 *
 *   1. surface boards for the metered sports (MLB, WNBA, tennis)
 *   2. expanded boards in EXPANDED_ORDER, each sport holding back the credits
 *      the sports after it need (MLB -> WNBA -> TENNIS -> SOCCER)
 *   3. surface boards for everything else (soccer, NFL)
 *
 * Each expanded event reads `/events/{id}/markets` first (1 credit) and asks
 * only for the keys a covered book is actually pricing. The odds endpoint bills
 * `markets × regions` whether or not a key returns anything, so on a full MLB
 * card the catalog pays for itself several times over.
 *
 * Snapshots are built with the app's own pure normalizers and written under the
 * same keys `odds-board-cache` / `odds-event-board-cache` use, so the app reads
 * them as its own. With WRITE_DB=1 it upserts straight into
 * `scl.OddsCacheSnapshot`; otherwise it only writes JSON for inspection.
 *
 * Intended to run from `.github/workflows/populate-odds.yml`, where the runner
 * holds the production DATABASE_URL and can reach Supabase over IPv6.
 *
 *   ODDS_KEY=<key> WRITE_DB=1 npx tsx scripts/populate-odds-today.ts
 *
 * BUDGET_FLOOR=<n>   stop spending once remaining hits this (default 0)
 * EXPANDED=<n>       max events to expand per sport (default 99)
 * EXPANDED_DAYS=<csv> ET slate days to expand: today,tomorrow (default tomorrow)
 * SPORTS=MLB,WNBA…   restrict the surface pass (default all)
 * EXPANDED_ORDER=<csv> expanded spend priority (default MLB,WNBA,TENNIS,SOCCER)
 * REST_RESERVE=<n>   credits held back for the soccer/NFL surface pass
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  dedupeOddsEvents,
  normalizeEventBoard,
  normalizeUpcomingEvent,
  sortByKickoff,
  type OddsEvent,
} from "@/lib/odds-board";
import { expandedBoardMarkets } from "@/lib/odds-verify";
import {
  selectLeaguesWithFixtures,
  selectSoccerLeagues,
  soccerLeagueByKey,
  SOCCER_LEAGUE_LIMIT,
  type LeagueFixtureWindow,
  type OddsApiSportRow,
  type SoccerLeague,
} from "@/lib/soccer-leagues";
import {
  selectTennisTours,
  TENNIS_CANDIDATE_LIMIT,
  TENNIS_TOUR_LIMIT,
  selectTennisToursWithFixtures,
  tennisTourByKey,
} from "@/lib/tennis-tours";
import {
  DEFAULT_EXPANDED_SPORT_ORDER,
  EVENT_MARKET_CATALOG_CREDIT_COST,
  eventMarketCatalogKeys,
  intersectExpandedMarkets,
  mergeLastGoodBoardEvents,
  parseExpandedSlateDays,
  selectExpandedSlateEvents,
} from "@/lib/manual-odds-population";

const KEY =
  process.env.ODDS_KEY?.trim() || process.env.ODDS_API_KEY?.trim() || "";
if (!KEY) throw new Error("ODDS_KEY or ODDS_API_KEY is required");
const BUDGET_FLOOR = Number(process.env.BUDGET_FLOOR ?? 0);
const EXPANDED_LIMIT = Number(process.env.EXPANDED ?? 99);
const EXPANDED_DAYS = parseExpandedSlateDays(
  process.env.EXPANDED_DAYS ?? "tomorrow",
);
const WRITE_DB = process.env.WRITE_DB === "1";
const ONLY = (process.env.SPORTS ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
const EXPANDED_ORDER = (
  process.env.EXPANDED_ORDER ?? DEFAULT_EXPANDED_SPORT_ORDER.join(",")
)
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter((s): s is (typeof DEFAULT_EXPANDED_SPORT_ORDER)[number] =>
    (DEFAULT_EXPANDED_SPORT_ORDER as readonly string[]).includes(s),
  );
/**
 * Credits held back from the expanded pass for the soccer + NFL surface boards
 * that run after it. Without it a long MLB card spends the key down to the
 * floor and the public soccer board goes out empty — a whole sport unbettable
 * so that one more baseball game could have its prop card.
 */
const REST_RESERVE = Number(process.env.REST_RESERVE ?? 45);
const OUT = join(process.cwd(), "tmp", "odds-populate");
const REGIONS = "us";
const SURFACE_MARKETS = "h2h,spreads,totals";

/** Mirrors ODDS_BOARD_RETENTION_SECONDS / ODDS_EVENT_RETENTION_SECONDS. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
/** Board caps applied by the live fetch path, matched here so the shapes agree. */
const BOARD_CAP = 60;
const SOCCER_BOARD_CAP = 80;
/** Free `/events` ranking window — matches `fetchUpcomingOdds` soccer selection. */
const SOCCER_CANDIDATE_LIMIT = 60;
const SOCCER_FIXTURE_WINDOW_HOURS = 72;

let remaining = Number.POSITIVE_INFINITY;
let used = 0;

function wanted(sport: string): boolean {
  return ONLY.length === 0 || ONLY.includes(sport.toUpperCase());
}

async function api(path: string): Promise<unknown | null> {
  if (remaining <= BUDGET_FLOOR) return null;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(
    `https://api.the-odds-api.com${path}${sep}apiKey=${KEY}`,
  );
  const rem = Number(res.headers.get("x-requests-remaining"));
  const usd = Number(res.headers.get("x-requests-used"));
  if (Number.isFinite(rem)) remaining = rem;
  if (Number.isFinite(usd)) used = usd;
  if (!res.ok) {
    console.log(`  ! HTTP ${res.status} ${path.slice(0, 70)}`);
    return null;
  }
  return res.json();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Unbilled Odds API reads (`/sports`, `/events`). Retries 429s. */
async function freeApi(path: string): Promise<unknown | null> {
  const sep = path.includes("?") ? "&" : "?";
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(
      `https://api.the-odds-api.com${path}${sep}apiKey=${KEY}`,
    );
    if (res.status === 429) {
      await sleep(400 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      console.log(`  ! HTTP ${res.status} ${path.slice(0, 70)}`);
      return null;
    }
    return res.json();
  }
  return null;
}

async function soccerLeaguesForBoard(
  catalog: OddsApiSportRow[],
): Promise<SoccerLeague[]> {
  const candidates = selectSoccerLeagues(catalog, SOCCER_CANDIDATE_LIMIT);
  const now = Date.now();
  const horizon = now + SOCCER_FIXTURE_WINDOW_HOURS * 3_600_000;
  const windows = new Map<string, LeagueFixtureWindow>();
  for (const league of candidates) {
    const rows = (await freeApi(`/v4/sports/${league.oddsApiKey}/events`)) as
      | { commence_time?: string }[]
      | null;
    if (!Array.isArray(rows)) continue;
    let upcoming = 0;
    let first: number | null = null;
    for (const row of rows) {
      const ms = Date.parse(row.commence_time ?? "");
      if (!Number.isFinite(ms) || ms < now) continue;
      if (ms <= horizon) upcoming += 1;
      if (first == null || ms < first) first = ms;
    }
    windows.set(league.oddsApiKey, { upcoming, firstKickoffMs: first });
  }
  const selected = selectLeaguesWithFixtures(
    candidates,
    windows,
    SOCCER_LEAGUE_LIMIT,
    now,
  );
  console.log(
    `  soccer slate: ${selected.map((league) => league.key).join(", ")} (from ${candidates.length} in season)`,
  );
  return selected;
}

type Snapshot = { key: string; payload: Record<string, unknown> };
const snapshots: Snapshot[] = [];

async function surface(sclSport: string, apiSport: string, league?: string) {
  const rows = (await api(
    `/v4/sports/${apiSport}/odds/?regions=${REGIONS}&markets=${SURFACE_MARKETS}&oddsFormat=american`,
  )) as Parameters<typeof normalizeUpcomingEvent>[1][] | null;
  if (!Array.isArray(rows)) return null;
  const events = rows
    .map((row) => normalizeUpcomingEvent(sclSport, row, undefined, league))
    .filter(
      (event) =>
        Date.parse(event.commenceTime) > Date.now() &&
        event.selections.length > 0,
    );
  console.log(
    `  ${apiSport.padEnd(38)} events=${String(events.length).padStart(3)} remaining=${remaining}`,
  );
  return events;
}

function pushBoard(sclSport: string, events: OddsEvent[], cap: number) {
  const ordered = sortByKickoff(dedupeOddsEvents(events)).slice(0, cap);
  if (ordered.length === 0) {
    console.log(`  ${sclSport}: no fresh events — retaining last-good board`);
    return [];
  }
  snapshots.push({
    key: `board:v1:${sclSport.toUpperCase()}`,
    payload: {
      version: 1,
      sport: sclSport.toUpperCase(),
      events: ordered,
      savedAt: Date.now(),
    },
  });
  return ordered;
}

/**
 * Per-event cost estimate used for the reserve: the market list plus the one
 * credit the market catalog costs. The catalog can only make the real spend
 * SMALLER, so estimating with it keeps the reserve on the safe side.
 */
function perEventCost(sclSport: string): number {
  return (
    expandedBoardMarkets(sclSport).length + EVENT_MARKET_CATALOG_CREDIT_COST
  );
}

/**
 * The Odds API sport key for one board event. Soccer and tennis fixtures carry
 * their competition on the event, so a single SCL sport spans many API sports.
 */
function apiSportForEvent(
  sclSport: string,
  apiSport: string,
  event: OddsEvent,
): string | null {
  if (apiSport) return apiSport;
  if (!event.league) return null;
  const key =
    sclSport === "SOCCER"
      ? soccerLeagueByKey(event.league)?.oddsApiKey
      : tennisTourByKey(event.league)?.oddsApiKey;
  return key ?? null;
}

/**
 * Expanded per-event boards for one sport, newest-kickoff-last, stopping while
 * `reserve` credits are still unspent so the sports after this one still run.
 */
async function expandSport(
  sclSport: string,
  apiSport: string,
  events: readonly OddsEvent[],
  reserve: number,
): Promise<void> {
  if (!wanted(sclSport)) return;
  const wantedMarkets = expandedBoardMarkets(sclSport);
  if (wantedMarkets.length === 0) return;
  const slate = selectExpandedSlateEvents(events, EXPANDED_DAYS).slice(
    0,
    EXPANDED_LIMIT,
  );
  if (slate.length === 0) {
    console.log(
      `  ${sclSport}: no ${EXPANDED_DAYS.join("+")} events to expand`,
    );
    return;
  }
  console.log(
    `  ${sclSport}: ${slate.length} ${EXPANDED_DAYS.join("+")} events, up to ${perEventCost(sclSport)} credits each (holding ${reserve} back)`,
  );

  let done = 0;
  let held = 0;
  for (const event of slate) {
    const floor = BUDGET_FLOOR + reserve;
    // Priced against the full list: the catalog has not been read yet, so the
    // worst case is what has to fit.
    if (remaining - perEventCost(sclSport) < floor) {
      held += 1;
      continue;
    }
    const sportKey = apiSportForEvent(sclSport, apiSport, event);
    if (!sportKey) continue;

    const catalog = await api(
      `/v4/sports/${sportKey}/events/${event.id}/markets?regions=${REGIONS}`,
    );
    const markets = intersectExpandedMarkets(
      wantedMarkets,
      eventMarketCatalogKeys(catalog),
    );
    if (markets.length === 0) {
      console.log(
        `    ${`${event.away} @ ${event.home}`.padEnd(48)}no covered book prices these markets`,
      );
      continue;
    }
    const raw = await api(
      `/v4/sports/${sportKey}/events/${event.id}/odds/?regions=${REGIONS}&markets=${markets.join(",")}&oddsFormat=american`,
    );
    if (!raw) break;
    const selections = normalizeEventBoard(
      raw as Parameters<typeof normalizeEventBoard>[0],
      { sport: sclSport },
    );
    if (!selections.length) continue;
    snapshots.push({
      key: `event-board:v1:${sclSport}:${event.id}`,
      payload: {
        version: 1,
        sport: sclSport,
        eventId: event.id,
        selections,
        savedAt: Date.now(),
      },
    });
    done++;
    console.log(
      `    ${`${event.away} @ ${event.home}`.padEnd(48)}mkt=${String(markets.length).padStart(2)}/${wantedMarkets.length} sel=${String(selections.length).padStart(4)} remaining=${remaining}`,
    );
  }
  console.log(
    `  ${sclSport}: expanded ${done}/${slate.length}${held ? ` (${held} held for later sports)` : ""} — remaining ${remaining}`,
  );
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const catalog = (await api("/v4/sports/")) as
    | {
        key?: string;
        group?: string;
        title?: string;
        active?: boolean;
        has_outrights?: boolean;
      }[]
    | null;
  if (!catalog) throw new Error("catalog fetch failed");
  console.log(`catalog ok — remaining ${remaining}\n\nSURFACE BOARDS`);

  let mlb: OddsEvent[] = [];
  let wnba: OddsEvent[] = [];
  let tennis: OddsEvent[] = [];

  if (wanted("MLB")) {
    const events = await surface("MLB", "baseball_mlb");
    if (events) mlb = pushBoard("MLB", events, BOARD_CAP);
  }
  if (wanted("WNBA")) {
    const events = await surface("WNBA", "basketball_wnba");
    if (events) wnba = pushBoard("WNBA", events, BOARD_CAP);
  }
  if (wanted("TENNIS")) {
    const events: OddsEvent[] = [];
    const candidates = selectTennisTours(catalog, TENNIS_CANDIDATE_LIMIT);
    const now = Date.now();
    const horizon = now + SOCCER_FIXTURE_WINDOW_HOURS * 3_600_000;
    const windows = new Map<
      string,
      { upcoming: number; firstKickoffMs: number | null }
    >();
    for (const tour of candidates) {
      const rows = (await freeApi(`/v4/sports/${tour.oddsApiKey}/events`)) as
        | { commence_time?: string }[]
        | null;
      if (!Array.isArray(rows)) continue;
      let upcoming = 0;
      let first: number | null = null;
      for (const row of rows) {
        const ms = Date.parse(row.commence_time ?? "");
        if (!Number.isFinite(ms) || ms < now) continue;
        if (ms <= horizon) upcoming += 1;
        if (first == null || ms < first) first = ms;
      }
      windows.set(tour.oddsApiKey, { upcoming, firstKickoffMs: first });
    }
    const tours = selectTennisToursWithFixtures(
      candidates,
      windows,
      TENNIS_TOUR_LIMIT,
      now,
    );
    console.log(
      `  tennis slate: ${tours.map((tour) => tour.key).join(", ")} (from ${candidates.length} in season)`,
    );
    for (const tour of tours) {
      events.push(
        ...((await surface("TENNIS", tour.oddsApiKey, tour.key)) ?? []),
      );
    }
    tennis = pushBoard("TENNIS", events, BOARD_CAP);
  }

  // ── expanded per-event markets ─────────────────────────────────────────────
  //
  // Ordered and reserved rather than first-come. A fifteen-game MLB card at the
  // full prop set costs more than a whole top-up key, so without a reserve the
  // first sport in the loop eats the budget and every sport after it ships an
  // empty expanded board.
  console.log(
    `\nEXPANDED PER-EVENT (order ${EXPANDED_ORDER.join(" > ")}, rest reserve ${REST_RESERVE})`,
  );
  const slates: Record<string, { apiSport: string; events: OddsEvent[] }> = {
    MLB: { apiSport: "baseball_mlb", events: mlb },
    WNBA: { apiSport: "basketball_wnba", events: wnba },
    TENNIS: { apiSport: "", events: tennis },
    SOCCER: { apiSport: "", events: [] },
  };
  const metered = EXPANDED_ORDER.filter((sport) => sport !== "SOCCER");
  for (let index = 0; index < metered.length; index += 1) {
    const sport = metered[index]!;
    const later = metered
      .slice(index + 1)
      .reduce(
        (sum, next) =>
          sum +
          selectExpandedSlateEvents(slates[next]!.events, EXPANDED_DAYS)
            .length *
            perEventCost(next),
        0,
      );
    await expandSport(
      sport,
      slates[sport]!.apiSport,
      slates[sport]!.events,
      later + REST_RESERVE,
    );
  }

  // ── everything else: surface boards only ───────────────────────────────────
  console.log("\nSURFACE BOARDS (rest)");
  if (wanted("SOCCER")) {
    const events: OddsEvent[] = [];
    for (const league of await soccerLeaguesForBoard(catalog)) {
      events.push(
        ...((await surface("SOCCER", league.oddsApiKey, league.key)) ?? []),
      );
    }
    slates.SOCCER!.events = pushBoard("SOCCER", events, SOCCER_BOARD_CAP);
  }
  if (wanted("NFL")) {
    // Preseason carries its own league tag so a pick logged there resolves back
    // to the preseason sport key at verification time.
    const regular = await surface("NFL", "americanfootball_nfl");
    const preseason = await surface(
      "NFL",
      "americanfootball_nfl_preseason",
      "AMERICANFOOTBALL_NFL_PRESEASON",
    );
    if (regular || preseason) {
      pushBoard("NFL", [...(regular ?? []), ...(preseason ?? [])], BOARD_CAP);
    }
  }

  // Soccer's one expanded market (Double Chance) runs last and on leftovers
  // only: it is one credit per fixture across eighty of them, and no fixture
  // becomes unbettable without it — the surface three are already on the board.
  if (EXPANDED_ORDER.includes("SOCCER")) {
    console.log("\nEXPANDED PER-EVENT (soccer, leftover credits)");
    await expandSport("SOCCER", "", slates.SOCCER!.events, 0);
  }

  writeFileSync(
    join(OUT, "snapshots.json"),
    JSON.stringify({ snapshots }, null, 2),
  );
  console.log(
    `\n${snapshots.length} snapshots built | credits used ${used} | remaining ${remaining}`,
  );

  if (!WRITE_DB) {
    console.log("WRITE_DB not set — nothing written to the database.");
    return;
  }

  // Imported lazily so a dry run needs no database at all.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    for (const snapshot of snapshots) {
      if (snapshot.key.startsWith("board:v1:")) {
        const prior = await prisma.oddsCacheSnapshot.findUnique({
          where: { key: snapshot.key },
          select: { payload: true },
        });
        const priorEvents =
          prior?.payload &&
          typeof prior.payload === "object" &&
          "events" in prior.payload &&
          Array.isArray(prior.payload.events)
            ? (prior.payload.events as unknown as OddsEvent[])
            : [];
        snapshot.payload.events = mergeLastGoodBoardEvents(
          snapshot.payload.events as unknown as OddsEvent[],
          priorEvents,
        );
      }
      const savedAt = new Date(snapshot.payload.savedAt as number);
      const expiresAt = new Date(
        (snapshot.payload.savedAt as number) + RETENTION_SECONDS * 1_000,
      );
      await prisma.oddsCacheSnapshot.upsert({
        where: { key: snapshot.key },
        create: {
          key: snapshot.key,
          payload: snapshot.payload as never,
          savedAt,
          expiresAt,
        },
        update: { payload: snapshot.payload as never, savedAt, expiresAt },
      });
      console.log(`  wrote ${snapshot.key}`);
    }
    console.log(`\ndatabase: ${snapshots.length} snapshots upserted`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
