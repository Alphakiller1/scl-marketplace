import "server-only";

import type { OddsEvent } from "@/lib/odds-board";
import {
  addEventBoardRows,
  loadCachedEventBoard,
} from "@/lib/odds-event-board-cache";
import {
  ESPN_DRAFTKINGS_CASINO_ID,
  ESPN_PROP_FILL_LEAGUES,
  espnDraftKingsPropRows,
  rowsForPlayersMissingFromBoard,
  teamNameMatches,
  type EspnPropItem,
} from "@/lib/espn-draftkings-props";

const ESPN_TIMEOUT_MS = 8_000;

/** How far ESPN's scheduled tip may sit from the provider's commence time. */
const TIP_MATCH_WINDOW_MS = 3 * 3_600_000;

export type EspnPropFillReport = {
  /** Boards looked at. */
  events: number;
  /** Rows added across them. */
  added: number;
  /** Players added, as ESPN names them. */
  players: string[];
};

type ScoreboardEvent = {
  id: string;
  date: string;
  competitors: { homeAway: string; teamId: string; nickname: string }[];
};

async function espnJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(ESPN_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`ESPN ${res.status} for ${url}`);
  return res.json();
}

function easternDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(iso))
    .replaceAll("-", "");
}

async function scoreboard(league: string, day: string) {
  const data = (await espnJson(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/scoreboard?dates=${day}`,
  )) as {
    events?: {
      id: string;
      date: string;
      competitions?: {
        competitors?: {
          homeAway: string;
          team?: { id?: string; name?: string };
        }[];
      }[];
    }[];
  };
  return (data.events ?? []).map(
    (event): ScoreboardEvent => ({
      id: event.id,
      date: event.date,
      competitors: (event.competitions?.[0]?.competitors ?? []).map((c) => ({
        homeAway: c.homeAway,
        teamId: c.team?.id ?? "",
        nickname: c.team?.name ?? "",
      })),
    }),
  );
}

function matchEvent(
  event: OddsEvent,
  candidates: readonly ScoreboardEvent[],
): ScoreboardEvent | null {
  const tip = Date.parse(event.commenceTime);
  return (
    candidates.find((candidate) => {
      const home = candidate.competitors.find((c) => c.homeAway === "home");
      const away = candidate.competitors.find((c) => c.homeAway === "away");
      return (
        home != null &&
        away != null &&
        teamNameMatches(event.home, home.nickname) &&
        teamNameMatches(event.away, away.nickname) &&
        Math.abs(Date.parse(candidate.date) - tip) <= TIP_MATCH_WINDOW_MS
      );
    }) ?? null
  );
}

async function draftKingsItems(
  league: string,
  espnEventId: string,
): Promise<EspnPropItem[]> {
  const items: EspnPropItem[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const data = (await espnJson(
      `https://sports.core.api.espn.com/v2/sports/basketball/leagues/${league}/events/${espnEventId}/competitions/${espnEventId}/odds/${ESPN_DRAFTKINGS_CASINO_ID}/propBets?lang=en&region=us&limit=1000&page=${page}`,
    )) as { items?: EspnPropItem[]; pageCount?: number };
    items.push(...(data.items ?? []));
    if (page >= (data.pageCount ?? 1)) break;
  }
  return items;
}

async function rosterNames(
  league: string,
  teamIds: readonly string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (const teamId of teamIds) {
    if (!teamId) continue;
    const data = (await espnJson(
      `https://site.api.espn.com/apis/site/v2/sports/basketball/${league}/teams/${teamId}/roster`,
    )) as { athletes?: { id?: string; displayName?: string }[] };
    for (const athlete of data.athletes ?? []) {
      if (athlete.id && athlete.displayName) {
        names.set(athlete.id, athlete.displayName);
      }
    }
  }
  return names;
}

/**
 * Add ESPN's DraftKings props for players the provider left off these boards.
 *
 * Zero Odds API credits. Only boards already bought are touched, only for games
 * not yet started, and only players with no row on the board get rows — so a
 * line the provider does carry is never repriced from here. A failure for one
 * game is logged and the rest carry on.
 */
export async function fillMissingPlayersFromEspn(
  sport: string,
  events: readonly OddsEvent[],
): Promise<EspnPropFillReport> {
  const report: EspnPropFillReport = { events: 0, added: 0, players: [] };
  const league = ESPN_PROP_FILL_LEAGUES[sport.trim().toUpperCase()];
  if (!league) return report;
  const scoreboards = new Map<string, Promise<ScoreboardEvent[]>>();
  for (const event of events) {
    if (Date.parse(event.commenceTime) <= Date.now()) continue;
    try {
      const cached = await loadCachedEventBoard(sport, event.id);
      if (cached.savedAt == null) continue;
      report.events += 1;
      const day = easternDateKey(event.commenceTime);
      if (!scoreboards.has(day)) scoreboards.set(day, scoreboard(league, day));
      const match = matchEvent(event, await scoreboards.get(day)!);
      if (!match) continue;
      const [items, names] = await Promise.all([
        draftKingsItems(league, match.id),
        rosterNames(
          league,
          match.competitors.map((c) => c.teamId),
        ),
      ]);
      const missing = rowsForPlayersMissingFromBoard(
        cached.selections,
        espnDraftKingsPropRows(items, names),
      );
      if (missing.length === 0) continue;
      const added = await addEventBoardRows(sport, event.id, missing);
      if (added === 0) continue;
      report.added += added;
      for (const player of new Set(missing.map((row) => row.player!))) {
        report.players.push(player);
      }
    } catch (error) {
      console.warn("[espn-prop-fill] event skipped", {
        sport,
        eventId: event.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return report;
}
