/**
 * Manual odds population — surface boards for every sport, plus expanded
 * per-event markets (alternate lines, team totals, innings segments, props)
 * for MLB, WNBA and tennis. Football and soccer stay surface-only: their
 * expanded market list is empty, so the bulk h2h/spreads/totals board is the
 * whole board.
 *
 * Runs on a fixed credit budget: it reports `x-requests-remaining` after every
 * call and stops at BUDGET_FLOOR rather than fetching a slate it cannot afford.
 * Expanded MLB is 44 credits PER EVENT, WNBA 24 and tennis 2 — a full 12-game
 * MLB slate costs 528 credits, more than a 500-credit key holds.
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
 * MARKETS=<csv>      fetch only these event markets instead of the sport's full
 *                    expanded list. Cost is one credit per market per event, so a
 *                    targeted top-up (`alternate_team_totals`) is 1 credit an
 *                    event where a whole MLB board is 44 — which is what makes a
 *                    nearly spent key still able to add a market. Merged into the
 *                    stored board, never written over it.
 * SURFACE=0          skip the billed surface pass and take the event list from the
 *                    free `/events` endpoint. No surface board is written, so a
 *                    top-up cannot overwrite one with selection-less events.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  dedupeOddsEvents,
  normalizeEventBoard,
  normalizeUpcomingEvent,
  sortByKickoff,
  type OddsEvent,
  type OddsSelection,
} from "@/lib/odds-board";
import { mergeEventBoardSelections } from "@/lib/odds-event-board-contract";
import { expandedBoardMarkets } from "@/lib/odds-verify";
import {
  selectLeaguesWithFixtures,
  selectSoccerLeagues,
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
const MARKET_OVERRIDE = (process.env.MARKETS ?? "")
  .split(",")
  .map((market) => market.trim())
  .filter(Boolean);
const REFRESH_SURFACE = process.env.SURFACE !== "0";
const ONLY = (process.env.SPORTS ?? "")
  .split(",")
  .map((s) => s.trim().toUpperCase())
  .filter(Boolean);
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

/**
 * The slate without paying for it — `/events` is unbilled and carries the ids,
 * kickoffs and clubs an expanded fetch needs. Selections are deliberately empty:
 * these rows exist to be expanded, never to be written as a board.
 */
async function freeEventList(
  sclSport: string,
  apiSport: string,
  league?: string,
): Promise<OddsEvent[]> {
  const rows = (await freeApi(`/v4/sports/${apiSport}/events`)) as
    | {
        id?: string;
        commence_time?: string;
        home_team?: string;
        away_team?: string;
      }[]
    | null;
  if (!Array.isArray(rows)) return [];
  const events = rows
    .filter(
      (row): row is { id: string; commence_time: string } & typeof row =>
        Boolean(row.id) && Date.parse(row.commence_time ?? "") > Date.now(),
    )
    .map((row) => ({
      id: row.id,
      sport: sclSport.toUpperCase(),
      ...(league ? { league } : {}),
      commenceTime: row.commence_time,
      home: row.home_team ?? "",
      away: row.away_team ?? "",
      selections: [],
    }));
  console.log(
    `  ${apiSport.padEnd(38)} events=${String(events.length).padStart(3)} (free listing)`,
  );
  return events;
}

/** Surface board when the pass is billed; the free listing when it is skipped. */
async function slateEvents(
  sclSport: string,
  apiSport: string,
  league?: string,
): Promise<OddsEvent[]> {
  if (!REFRESH_SURFACE) return freeEventList(sclSport, apiSport, league);
  return (await surface(sclSport, apiSport, league)) ?? [];
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
 * Open the database BEFORE the first billed call.
 *
 * The writes used to happen only after the whole slate had been fetched, so a
 * database the runner could not reach — a DATABASE_URL secret pointing at the
 * wrong project, say — surfaced as a Prisma error with every credit already
 * spent and the snapshots discarded with the runner. A run that cannot write is
 * a run that must not fetch.
 */
async function openDatabase() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  const boards = await prisma.oddsCacheSnapshot.count();
  console.log(`database ok — ${boards} cached snapshots\n`);
  return prisma;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  // Imported lazily so a dry run needs no database at all.
  const prisma = WRITE_DB ? await openDatabase() : null;
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
    const events = await slateEvents("MLB", "baseball_mlb");
    mlb = REFRESH_SURFACE ? pushBoard("MLB", events, BOARD_CAP) : events;
  }
  if (wanted("WNBA")) {
    const events = await slateEvents("WNBA", "basketball_wnba");
    wnba = REFRESH_SURFACE ? pushBoard("WNBA", events, BOARD_CAP) : events;
  }
  // Football and soccer are surface-only — no expanded markets — so a run that
  // skips the surface pass has nothing to do for them.
  if (wanted("NFL") && REFRESH_SURFACE) {
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
      events.push(...(await slateEvents("TENNIS", tour.oddsApiKey, tour.key)));
    }
    tennis = REFRESH_SURFACE ? pushBoard("TENNIS", events, BOARD_CAP) : events;
  }
  if (wanted("SOCCER") && REFRESH_SURFACE) {
    const events: OddsEvent[] = [];
    for (const league of await soccerLeaguesForBoard(catalog)) {
      events.push(
        ...((await surface("SOCCER", league.oddsApiKey, league.key)) ?? []),
      );
    }
    pushBoard("SOCCER", events, SOCCER_BOARD_CAP);
  }

  // ── expanded per-event markets ─────────────────────────────────────────────
  console.log("\nEXPANDED PER-EVENT (alt lines, team totals, segments, props)");
  for (const { sclSport, apiSportFor, events } of [
    // Cheapest first, so the sport that can exhaust the key never decides
    // whether the others get a board at all. Tennis is 2 credits an event and
    // WNBA ~24; a 500-credit key cannot finish a 15-game MLB expanded slate
    // (44/event) AND the rest if MLB goes first.
    {
      sclSport: "TENNIS",
      // Tennis has no single sport key — one per tournament — so the event's
      // league tag is the only route back to it, exactly as
      // `resolveOddsApiSport` does for the live path.
      apiSportFor: (event: OddsEvent) =>
        tennisTourByKey(event.league ?? "")?.oddsApiKey,
      events: tennis,
    },
    {
      sclSport: "WNBA",
      apiSportFor: () => "basketball_wnba",
      events: wnba,
    },
    {
      sclSport: "MLB",
      apiSportFor: () => "baseball_mlb",
      events: mlb,
    },
  ] as const) {
    const expandedEvents = selectExpandedSlateEvents(events, EXPANDED_DAYS);
    if (!expandedEvents.length) continue;
    const markets = MARKET_OVERRIDE.length
      ? MARKET_OVERRIDE
      : expandedBoardMarkets(sclSport);
    if (!markets.length) continue;
    console.log(
      `  ${sclSport}: ${markets.length} markets/event x ${expandedEvents.length} ${EXPANDED_DAYS.join("+")} events = ${markets.length * expandedEvents.length} credits for the expanded slate`,
    );
    let done = 0;
    for (const event of expandedEvents) {
      if (done >= EXPANDED_LIMIT || remaining <= BUDGET_FLOOR) break;
      const apiSport = apiSportFor(event);
      // A tennis event with no resolvable tour key has no endpoint to ask.
      if (!apiSport) continue;
      const raw = await api(
        `/v4/sports/${apiSport}/events/${event.id}/odds/?regions=${REGIONS}&markets=${markets.join(",")}&oddsFormat=american`,
      );
      if (!raw) break;
      const selections = normalizeEventBoard(
        raw as Parameters<typeof normalizeEventBoard>[0],
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
        `    ${`${event.away} @ ${event.home}`.padEnd(48)}sel=${String(selections.length).padStart(4)} remaining=${remaining}`,
      );
    }
  }

  writeFileSync(
    join(OUT, "snapshots.json"),
    JSON.stringify({ snapshots }, null, 2),
  );
  console.log(
    `\n${snapshots.length} snapshots built | credits used ${used} | remaining ${remaining}`,
  );

  if (!prisma) {
    console.log("WRITE_DB not set — nothing written to the database.");
    return;
  }

  try {
    for (const snapshot of snapshots) {
      const prior = await prisma.oddsCacheSnapshot.findUnique({
        where: { key: snapshot.key },
        select: { payload: true },
      });
      const priorPayload =
        prior?.payload && typeof prior.payload === "object"
          ? (prior.payload as Record<string, unknown>)
          : null;
      if (snapshot.key.startsWith("board:v1:")) {
        const priorEvents = Array.isArray(priorPayload?.events)
          ? (priorPayload.events as unknown as OddsEvent[])
          : [];
        snapshot.payload.events = mergeLastGoodBoardEvents(
          snapshot.payload.events as unknown as OddsEvent[],
          priorEvents,
        );
      }
      if (snapshot.key.startsWith("event-board:v1:")) {
        // Merge, never replace — the same contract `refreshEventBoard` applies
        // on the live path. A plain upsert was fine while every run asked for
        // the sport's whole market list, but it makes a targeted MARKETS top-up
        // destructive: writing 48 alternate team totals over a 590-selection
        // board would delete every prop, segment and alternate line on it.
        const priorSelections = Array.isArray(priorPayload?.selections)
          ? (priorPayload.selections as unknown as OddsSelection[])
          : [];
        snapshot.payload.selections = mergeEventBoardSelections(
          priorSelections,
          snapshot.payload.selections as unknown as OddsSelection[],
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
