import type { BoxScore } from "@/lib/results/prop-resolve";

/**
 * Fetches per-period line-scores from ESPN's public event-summary endpoint —
 * the same free ESPN family already used for scoreboards. Used to auto-grade
 * First-Five / first-N-innings totals (MLB), which the game-final providers
 * can't settle. Returns null on any error or missing data so the caller defers
 * (never settles on incomplete data). See docs/GRADING_PROPS_STATS_FEED_SPEC.md.
 */

/** SCL sport → ESPN summary path. Only sports with period totals we can grade. */
const ESPN_SUMMARY_PATH: Record<string, string> = {
  MLB: "baseball/mlb",
};

type EspnCompetitor = {
  homeAway?: string;
  linescores?: { value?: number | string }[];
};

export async function fetchPeriodBoxScore(
  sport: string,
  eventId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<BoxScore | null> {
  const path = ESPN_SUMMARY_PATH[sport.toUpperCase()];
  if (!path || !eventId) return null;

  try {
    const res = await fetchImpl(
      `https://site.api.espn.com/apis/site/v2/sports/${path}/summary?event=${encodeURIComponent(eventId)}`,
      { headers: { accept: "application/json" } },
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    return mapSummaryToBoxScore(data);
  } catch {
    return null;
  }
}

/** Pure mapper (unit-testable) — ESPN summary JSON → per-period line-scores. */
export function mapSummaryToBoxScore(data: unknown): BoxScore | null {
  const competitors = (
    data as {
      header?: { competitions?: { competitors?: EspnCompetitor[] }[] };
    }
  )?.header?.competitions?.[0]?.competitors;
  if (!Array.isArray(competitors) || competitors.length < 2) return null;

  const home = competitors.find((c) => c.homeAway === "home");
  const away = competitors.find((c) => c.homeAway === "away");
  if (!home || !away) return null;

  const periods = (c: EspnCompetitor): number[] | null => {
    const ls = c.linescores;
    if (!Array.isArray(ls) || ls.length === 0) return null;
    const nums = ls.map((l) => Number(l.value));
    return nums.every((n) => Number.isFinite(n)) ? nums : null;
  };

  const homePeriods = periods(home);
  const awayPeriods = periods(away);
  if (!homePeriods || !awayPeriods) return null;

  return { homePeriods, awayPeriods };
}
