/**
 * Manual odds population — surface boards for every sport, plus expanded
 * per-event markets (alternate lines, team totals, innings segments, props)
 * for MLB and WNBA.
 *
 * Runs on a fixed credit budget: it reports `x-requests-remaining` after every
 * call and stops at BUDGET_FLOOR rather than fetching a slate it cannot afford.
 * Expanded MLB is 34 credits PER EVENT and WNBA 24, measured — a full 11-game
 * MLB slate is 374 credits, more than a 500-credit key holds.
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
import { selectSoccerLeagues, SOCCER_LEAGUE_LIMIT } from "@/lib/soccer-leagues";
import { selectTennisTours, TENNIS_TOUR_LIMIT } from "@/lib/tennis-tours";
import {
  mergeLastGoodBoardEvents,
  parseExpandedSlateDays,
  selectExpandedSlateEvents,
} from "@/lib/manual-odds-population";

const KEY = process.env.ODDS_KEY?.trim();
if (!KEY) throw new Error("ODDS_KEY is required");
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
const OUT = join(process.cwd(), "tmp", "odds-populate");
const REGIONS = "us";
const SURFACE_MARKETS = "h2h,spreads,totals";

/** Mirrors ODDS_BOARD_RETENTION_SECONDS / ODDS_EVENT_RETENTION_SECONDS. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;
/** Board caps applied by the live fetch path, matched here so the shapes agree. */
const BOARD_CAP = 60;
const SOCCER_BOARD_CAP = 80;

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

  if (wanted("MLB")) {
    const events = await surface("MLB", "baseball_mlb");
    if (events) mlb = pushBoard("MLB", events, BOARD_CAP);
  }
  if (wanted("WNBA")) {
    const events = await surface("WNBA", "basketball_wnba");
    if (events) wnba = pushBoard("WNBA", events, BOARD_CAP);
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
  if (wanted("TENNIS")) {
    const events: OddsEvent[] = [];
    for (const tour of selectTennisTours(catalog, TENNIS_TOUR_LIMIT)) {
      events.push(
        ...((await surface("TENNIS", tour.oddsApiKey, tour.key)) ?? []),
      );
    }
    pushBoard("TENNIS", events, BOARD_CAP);
  }
  if (wanted("SOCCER")) {
    const events: OddsEvent[] = [];
    for (const league of selectSoccerLeagues(catalog, SOCCER_LEAGUE_LIMIT)) {
      events.push(
        ...((await surface("SOCCER", league.oddsApiKey, league.key)) ?? []),
      );
    }
    pushBoard("SOCCER", events, SOCCER_BOARD_CAP);
  }

  // ── expanded per-event markets ─────────────────────────────────────────────
  console.log("\nEXPANDED PER-EVENT (alt lines, team totals, segments, props)");
  for (const [sclSport, apiSport, events] of [
    ["MLB", "baseball_mlb", mlb],
    ["WNBA", "basketball_wnba", wnba],
  ] as const) {
    const expandedEvents = selectExpandedSlateEvents(events, EXPANDED_DAYS);
    if (!expandedEvents.length) continue;
    const markets = expandedBoardMarkets(sclSport);
    console.log(
      `  ${sclSport}: ${markets.length} markets/event x ${expandedEvents.length} ${EXPANDED_DAYS.join("+")} events = ${markets.length * expandedEvents.length} credits for the expanded slate`,
    );
    let done = 0;
    for (const event of expandedEvents) {
      if (done >= EXPANDED_LIMIT || remaining <= BUDGET_FLOOR) break;
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
