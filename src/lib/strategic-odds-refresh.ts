import "server-only";

import { normalizeUpcomingEvent, type OddsEvent } from "@/lib/odds-board";
import { updateOddsBoardSegment } from "@/lib/odds-board-cache";
import { loadCachedOddsBoard } from "@/lib/odds-board-cache";
import {
  readDurableOddsSnapshot,
  writeDurableOddsSnapshot,
} from "@/lib/odds-durable-cache";
import { fetchWithOddsKeyRollover } from "@/lib/odds-key-rollover";
import {
  dueRefreshSlots,
  STRATEGIC_ODDS_COMPETITIONS,
} from "@/lib/strategic-odds-policy";

const MARKER_TTL = 14 * 24 * 60 * 60;
const markerKey = (slot: string) => `strategic-refresh:v1:${slot}`;

type RawEvent = Parameters<typeof normalizeUpcomingEvent>[1];

async function providerJson<T>(
  path: (key: string) => string,
): Promise<T | null> {
  const { response } = await fetchWithOddsKeyRollover(path, {
    cache: "no-store",
  });
  if (!response?.ok) return null;
  return (await response.json()) as T;
}

export type StrategicRefreshResult = {
  refreshed: string[];
  retained: string[];
  skipped: string[];
};

export async function runStrategicOddsRefresh(
  now = new Date(),
): Promise<StrategicRefreshResult> {
  const result: StrategicRefreshResult = {
    refreshed: [],
    retained: [],
    skipped: [],
  };
  const catalog = await providerJson<
    Array<{ key: string; title: string; active: boolean }>
  >((key) => `https://api.the-odds-api.com/v4/sports/?apiKey=${key}`);

  for (const competition of STRATEGIC_ODDS_COMPETITIONS) {
    const providerKey =
      competition.providerKey ??
      catalog?.find(
        (row) =>
          row.active &&
          competition.catalogMatch?.test(`${row.key} ${row.title}`),
      )?.key;
    if (!providerKey) {
      result.skipped.push(`${competition.id}:unavailable`);
      continue;
    }

    const schedule = await providerJson<RawEvent[]>(
      (key) =>
        `https://api.the-odds-api.com/v4/sports/${providerKey}/events?apiKey=${key}`,
    );
    if (!schedule?.length) {
      result.skipped.push(`${competition.id}:no-events`);
      continue;
    }
    const starts = schedule.map((event) => new Date(event.commence_time));

    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
    }).format(now);
    const bootstrapSlot = `${competition.id}:${today}:bootstrap`;
    const possible = [
      bootstrapSlot,
      ...competition.slots.flatMap((slot) => {
        if (slot.kind === "before-first")
          return starts.map(
            (date) =>
              `${competition.id}:${new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(date)}:${slot.id}`,
          );
        return [
          `${competition.id}:${new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now)}:${slot.id}`,
        ];
      }),
    ];
    const completed = new Set<string>();
    for (const slot of possible)
      if (await readDurableOddsSnapshot(markerKey(slot))) completed.add(slot);
    const cached = await loadCachedOddsBoard(competition.sclSport);
    const hasCurrentSegment = cached.events.some((event) => {
      if (Date.parse(event.commenceTime) <= now.getTime()) return false;
      return competition.league ? event.league === competition.league : true;
    });
    const due = dueRefreshSlots(competition, starts, completed, now);
    if (!hasCurrentSegment && !completed.has(bootstrapSlot)) {
      due.unshift(bootstrapSlot);
    }
    if (!due.length) {
      result.skipped.push(`${competition.id}:not-due`);
      continue;
    }

    const markets = competition.markets.join(",");
    const odds = await providerJson<RawEvent[]>(
      (key) =>
        `https://api.the-odds-api.com/v4/sports/${providerKey}/odds/?apiKey=${key}&regions=us&markets=${markets}&oddsFormat=american`,
    );
    const events: OddsEvent[] = (odds ?? [])
      .map((event) =>
        normalizeUpcomingEvent(
          competition.sclSport,
          event,
          undefined,
          competition.league,
        ),
      )
      .filter((event) => event.selections.length > 0);
    if (!events.length) {
      result.retained.push(competition.id);
      continue;
    }

    await updateOddsBoardSegment(
      competition.sclSport,
      competition.league,
      events,
    );
    for (const slot of due)
      await writeDurableOddsSnapshot(
        markerKey(slot),
        { completedAt: now.toISOString() },
        now.getTime(),
        MARKER_TTL,
      );
    result.refreshed.push(competition.id);
  }
  return result;
}
