/**
 * Manual odds population — surface boards for every sport, plus expanded
 * per-event markets for MLB and WNBA.
 *
 * Written for a hand-run refresh on a fixed credit budget, which is why it
 * reports `x-requests-remaining` after every call and stops at BUDGET_FLOOR
 * rather than fetching the whole slate. Expanded MLB is 34 credits PER EVENT
 * and WNBA is 24, so a full slate costs more than a 500-credit key holds.
 *
 * Snapshots are built with the app's own pure normalizers, so the payload
 * shape matches what `odds-board-cache` / `odds-event-board-cache` write. The
 * output is JSON on disk; the rows are inserted separately.
 *
 *   ODDS_KEY=<key> npx tsx scripts/populate-odds-today.ts
 *
 * BUDGET_FLOOR=<n>  stop spending once remaining drops to this (default 250,
 *                   which reserves half a 500-credit key for a second run).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { normalizeEventBoard, normalizeUpcomingEvent } from "@/lib/odds-board";
import { expandedBoardMarkets } from "@/lib/odds-verify";
import { selectSoccerLeagues, SOCCER_LEAGUE_LIMIT } from "@/lib/soccer-leagues";
import { selectTennisTours, TENNIS_TOUR_LIMIT } from "@/lib/tennis-tours";

const KEY = process.env.ODDS_KEY?.trim();
if (!KEY) throw new Error("ODDS_KEY is required");
const BUDGET_FLOOR = Number(process.env.BUDGET_FLOOR ?? 250);
const OUT = join(process.cwd(), "tmp", "odds-populate");
const REGIONS = "us";
const SURFACE_MARKETS = "h2h,spreads,totals";

/** Retention mirrors ODDS_BOARD_RETENTION_SECONDS / ODDS_EVENT_RETENTION_SECONDS. */
const RETENTION_SECONDS = 30 * 24 * 60 * 60;

let remaining = Number.POSITIVE_INFINITY;
let used = 0;

async function api(path: string): Promise<unknown | null> {
  if (remaining <= BUDGET_FLOOR) {
    console.log(
      `  [budget] stopping — remaining ${remaining} <= ${BUDGET_FLOOR}`,
    );
    return null;
  }
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

type Snapshot = { key: string; payload: unknown };
const snapshots: Snapshot[] = [];

function pushBoard(sclSport: string, events: unknown[]) {
  snapshots.push({
    key: `board:v1:${sclSport.toUpperCase()}`,
    payload: {
      version: 1,
      sport: sclSport.toUpperCase(),
      events,
      savedAt: Date.now(),
    },
  });
}

function pushEventBoard(
  sclSport: string,
  eventId: string,
  selections: unknown[],
) {
  snapshots.push({
    key: `event-board:v1:${sclSport.toUpperCase()}:${eventId}`,
    payload: {
      version: 1,
      sport: sclSport.toUpperCase(),
      eventId,
      selections,
      savedAt: Date.now(),
    },
  });
}

/** Surface board for one Odds API sport key, normalized to SCL events. */
async function surfaceBoard(
  sclSport: string,
  apiSport: string,
  league?: string,
) {
  const rows = (await api(
    `/v4/sports/${apiSport}/odds/?regions=${REGIONS}&markets=${SURFACE_MARKETS}&oddsFormat=american`,
  )) as Parameters<typeof normalizeUpcomingEvent>[1][] | null;
  if (!Array.isArray(rows)) return [];
  const events = rows.map((row) =>
    normalizeUpcomingEvent(sclSport, row, undefined, league),
  );
  console.log(
    `  ${apiSport.padEnd(38)} events=${String(events.length).padStart(3)} remaining=${remaining}`,
  );
  return events;
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
  console.log(`catalog ok — remaining ${remaining}\n`);

  // ── surface boards ─────────────────────────────────────────────────────────
  console.log("SURFACE BOARDS");
  const mlb = await surfaceBoard("MLB", "baseball_mlb");
  pushBoard("MLB", mlb);

  const wnba = await surfaceBoard("WNBA", "basketball_wnba");
  pushBoard("WNBA", wnba);

  // NFL regular + preseason share one SCL board; preseason carries its own tag
  // so a pick logged there resolves back to the preseason key at verification.
  const nflReg = await surfaceBoard("NFL", "americanfootball_nfl");
  const nflPre = await surfaceBoard(
    "NFL",
    "americanfootball_nfl_preseason",
    "AMERICANFOOTBALL_NFL_PRESEASON",
  );
  pushBoard("NFL", [...nflReg, ...nflPre]);

  const tours = selectTennisTours(catalog, TENNIS_TOUR_LIMIT);
  const tennis: unknown[] = [];
  for (const t of tours) {
    tennis.push(...(await surfaceBoard("TENNIS", t.oddsApiKey, t.key)));
  }
  pushBoard("TENNIS", tennis);

  const leagues = selectSoccerLeagues(catalog, SOCCER_LEAGUE_LIMIT);
  const soccer: unknown[] = [];
  for (const l of leagues) {
    soccer.push(...(await surfaceBoard("SOCCER", l.oddsApiKey, l.key)));
  }
  pushBoard("SOCCER", soccer);

  // ── expanded per-event markets (MLB + WNBA) ────────────────────────────────
  console.log("\nEXPANDED PER-EVENT (MLB, WNBA)");
  for (const [sclSport, apiSport, events] of [
    ["MLB", "baseball_mlb", mlb],
    ["WNBA", "basketball_wnba", wnba],
  ] as const) {
    const markets = expandedBoardMarkets(sclSport);
    console.log(
      `  ${sclSport}: ${markets.length} markets/event, ${events.length} events => ${markets.length * events.length} credits for the full slate`,
    );
    for (const ev of events) {
      if (remaining <= BUDGET_FLOOR) break;
      const raw = await api(
        `/v4/sports/${apiSport}/events/${ev.id}/odds/?regions=${REGIONS}&markets=${markets.join(",")}&oddsFormat=american`,
      );
      if (!raw) break;
      const selections = normalizeEventBoard(
        raw as Parameters<typeof normalizeEventBoard>[0],
      );
      pushEventBoard(sclSport, ev.id, selections);
      console.log(
        `    ${ev.away} @ ${ev.home}`.padEnd(52) +
          `sel=${String(selections.length).padStart(4)} remaining=${remaining}`,
      );
    }
  }

  const savedAt = Date.now();
  const expiresAt = savedAt + RETENTION_SECONDS * 1000;
  writeFileSync(
    join(OUT, "snapshots.json"),
    JSON.stringify({ savedAt, expiresAt, snapshots }, null, 2),
  );
  console.log(
    `\nwrote ${snapshots.length} snapshots -> ${join(OUT, "snapshots.json")}`,
  );
  console.log(`credits used this run: ${used} | remaining: ${remaining}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
