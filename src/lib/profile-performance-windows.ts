import type { Outcome } from "@prisma/client";

import { etDayBounds, etYearStart } from "@/lib/et-day";
import { MIN_GRADED_FOR_SIGNAL } from "@/lib/sample";
import {
  computeCapperStats,
  computeStatsBySport,
  type CapperStats,
  type SportStats,
  type StatsBaseline,
} from "@/lib/stats";

/**
 * Time scopes for the capper profile performance section.
 *
 * These mirror the Rank-mode leaderboard scopes on purpose: a capper's 7D
 * record has to read the same on their profile as it does on the board, or the
 * two surfaces quietly disagree about the same picks. `ytd` is the one scope
 * the board does not publish (its `year` key is URL back-compat only).
 */
export type ProfilePerfWindow =
  | "1d"
  | "7d"
  | "14d"
  | "30d"
  | "90d"
  | "ytd"
  | "all";

export const PROFILE_PERF_WINDOWS = [
  { key: "1d", label: "Yesterday", longLabel: "Yesterday's Results" },
  { key: "7d", label: "7D", longLabel: "Last 7 Days" },
  { key: "14d", label: "14D", longLabel: "Last 14 Days" },
  { key: "30d", label: "30D", longLabel: "Last 30 Days" },
  { key: "90d", label: "90D", longLabel: "Last 90 Days" },
  { key: "ytd", label: "YTD", longLabel: "Year to Date" },
  { key: "all", label: "All", longLabel: "All Time" },
] as const satisfies ReadonlyArray<{
  key: ProfilePerfWindow;
  label: string;
  longLabel: string;
}>;

/**
 * Scopes that stay computed but are not offered on the bar.
 *
 * A hidden scope is still built by `buildProfileWindowStats`, so restoring one
 * is a change to this list alone - no query, payload or UI work. It is also
 * excluded from `selectDefaultProfileWindow` by default, so a profile never
 * opens on a scope the reader has no way to leave.
 *
 * YTD is hidden at the owners' request. Its machinery is kept because the
 * scope is genuinely tricky - the legacy CURRENT_YEAR aggregate is the old
 * site's own year-to-date page and already contains the imported pick rows, so
 * the double-count guard behind it would have to be rebuilt from scratch.
 *
 * All Time is deliberately NOT hidden: it is the only scope that can carry the
 * pre-import record, since the YEAR_2025 / YEAR_2024 rows are frozen
 * aggregates with no per-pick dates and cannot sit in a rolling window.
 * Dropping it would strand two years of record a capper actually earned.
 */
export const PROFILE_PERF_HIDDEN_WINDOWS: readonly ProfilePerfWindow[] = [
  "ytd",
];

export const PROFILE_PERF_VISIBLE_WINDOWS = PROFILE_PERF_WINDOWS.filter(
  (entry) => !PROFILE_PERF_HIDDEN_WINDOWS.includes(entry.key),
);

export function isProfilePerfWindow(
  value: string | null | undefined,
): value is ProfilePerfWindow {
  return PROFILE_PERF_WINDOWS.some((entry) => entry.key === value);
}

export function profilePerfWindowLabel(window: ProfilePerfWindow): string {
  return (
    PROFILE_PERF_WINDOWS.find((entry) => entry.key === window)?.longLabel ??
    window
  );
}

/**
 * Inclusive start / exclusive end for a scope.
 *
 * Yesterday is the last completed Eastern slate day and is bounded on both
 * sides, matching `leaderboardWindowBounds`. YTD is an ET calendar boundary.
 * The day scopes stay rolling from `now`.
 */
export function profilePerfWindowBounds(
  window: ProfilePerfWindow,
  now: Date,
): { start: Date | null; end: Date | null } {
  if (window === "all") return { start: null, end: null };
  if (window === "1d") return etDayBounds(-1, now);
  if (window === "ytd") return { start: etYearStart(now), end: null };
  const days = Number(window.replace("d", ""));
  return { start: new Date(now.getTime() - days * 86_400_000), end: null };
}

/**
 * A settled position of record. A parlay is one position, never its legs.
 *
 * `slateAt` is the instant that places the position on a scope - event start
 * where the pick is bound to a game, else log time - so a late West Coast game
 * that grades after midnight ET still counts on the day it was played. This is
 * `leaderboardSlateInstant` semantics, kept identical on purpose.
 *
 * `createdAt` stays separate because the legacy snapshot boundary is a log-time
 * question, not a slate-day one.
 */
export type ProfilePosition = {
  slateAt: Date;
  createdAt: Date;
  outcome: Outcome;
  units: number;
  profitUnits: number | null;
  sport: string;
  clvPts?: number | null;
};

/**
 * Whether a position belongs to a scope.
 *
 * Positions dated after `now` are excluded from every scope. A graded pick
 * with a future slate is a data anomaly, and letting one through would put a
 * result in the chart that the metric row could not explain.
 */
export function positionInProfilePerfWindow(
  position: Pick<ProfilePosition, "slateAt">,
  window: ProfilePerfWindow,
  now: Date,
): boolean {
  return withinBounds(
    position.slateAt.getTime(),
    profilePerfWindowBounds(window, now),
    now.getTime(),
  );
}

/**
 * A reusable membership test for one scope.
 *
 * Resolving bounds is not cheap - the ET helpers walk `Intl.DateTimeFormat`
 * to find a real midnight - so anything filtering more than a couple of
 * positions should build the predicate once and apply it, rather than calling
 * `positionInProfilePerfWindow` per row.
 */
export function profilePerfWindowFilter(
  window: ProfilePerfWindow,
  now: Date,
): (slateAt: Date) => boolean {
  const bounds = profilePerfWindowBounds(window, now);
  const nowMs = now.getTime();
  return (slateAt) => withinBounds(slateAt.getTime(), bounds, nowMs);
}

function withinBounds(
  at: number,
  { start, end }: { start: Date | null; end: Date | null },
  nowMs: number,
): boolean {
  if (at > nowMs) return false;
  if (start && at < start.getTime()) return false;
  if (end && at >= end.getTime()) return false;
  return true;
}

export type ProfileWindowStats = {
  window: ProfilePerfWindow;
  stats: CapperStats;
  bySport: SportStats[];
  /** Settled positions behind this scope, carried results included. */
  graded: number;
  avgClv: number | null;
  clvSampleCount: number;
  /** Meets the public sample gate, so it may become the default scope. */
  qualifies: boolean;
  /** A frozen pre-import aggregate is folded in, so there are no receipts. */
  carriesLegacy: boolean;
};

/**
 * Per-scope performance for one capper, built from a single set of positions.
 *
 * Carried legacy results are frozen aggregates with no per-pick dates, so they
 * only reach the two scopes that can honestly hold them:
 *
 * - `all` takes `allTimeBaseline` (PRE_IMPORT + prior complete years).
 * - `ytd` takes `ytdBaseline` (the old site's own year-to-date page). That
 *   aggregate already contains the imported pick rows, so positions logged at
 *   or before `legacySnapshotAt` are dropped from YTD rather than counted
 *   twice.
 *
 * Every rolling scope stays receipt-only: folding a frozen snapshot into a
 * trailing window would invent form the source never had.
 */
export function buildProfileWindowStats({
  positions,
  now,
  allTimeBaseline = null,
  ytdBaseline = null,
  legacySnapshotAt = null,
  minGraded = MIN_GRADED_FOR_SIGNAL,
}: {
  positions: ProfilePosition[];
  now: Date;
  allTimeBaseline?: StatsBaseline | null;
  ytdBaseline?: StatsBaseline | null;
  legacySnapshotAt?: Date | null;
  minGraded?: number;
}): Record<ProfilePerfWindow, ProfileWindowStats> {
  const nowMs = now.getTime();
  const entries = PROFILE_PERF_WINDOWS.map(({ key }) => {
    const bounds = profilePerfWindowBounds(key, now);
    let members = positions.filter((position) =>
      withinBounds(position.slateAt.getTime(), bounds, nowMs),
    );

    let baseline: StatsBaseline | null = null;
    if (key === "all") {
      baseline = allTimeBaseline;
    } else if (key === "ytd" && ytdBaseline) {
      baseline = ytdBaseline;
      // Inside the aggregate already - see the doc comment above.
      if (legacySnapshotAt) {
        const cutoff = legacySnapshotAt.getTime();
        members = members.filter(
          (position) => position.createdAt.getTime() > cutoff,
        );
      }
    }

    const stats = computeCapperStats(members, baseline);
    const clv = members
      .map((position) => position.clvPts)
      .filter(
        (value): value is number => value != null && Number.isFinite(value),
      );

    return [
      key,
      {
        window: key,
        stats,
        // Receipt-derived only. A carried aggregate has no per-sport picks to
        // attribute here; the query layer merges the legacy sport table in.
        bySport: computeStatsBySport(members),
        graded: stats.settled,
        avgClv: clv.length
          ? clv.reduce((sum, value) => sum + value, 0) / clv.length
          : null,
        clvSampleCount: clv.length,
        qualifies: stats.settled >= minGraded,
        carriesLegacy: baseline != null,
      } satisfies ProfileWindowStats,
    ] as const;
  });

  return Object.fromEntries(entries) as Record<
    ProfilePerfWindow,
    ProfileWindowStats
  >;
}

/** Widest first - the fallback order when nothing clears the sample gate. */
const WIDEST_FIRST: readonly ProfilePerfWindow[] = [
  "all",
  "ytd",
  "90d",
  "30d",
  "14d",
  "7d",
  "1d",
];

/**
 * The scope a profile opens on: the best-performing one that clears the sample
 * gate, per the owners' rule.
 *
 * Ranked by ROI, not units. Units accumulate with volume, so ranking on them
 * would hand the default to the widest scope almost every time and defeat the
 * stated intent - a genuinely strong 7-day stretch should be able to win the
 * slot. ROI is a rate, so scopes of different sizes compare honestly, and the
 * `minGraded` gate is what stops a 2-pick heater from taking it.
 *
 * With nothing qualifying, this falls back to the widest scope that has any
 * settled result, so a new capper still opens on something real rather than an
 * empty Yesterday.
 */
export function selectDefaultProfileWindow(
  byWindow: Record<ProfilePerfWindow, ProfileWindowStats>,
  {
    eligible = PROFILE_PERF_VISIBLE_WINDOWS.map((entry) => entry.key),
  }: { eligible?: readonly ProfilePerfWindow[] } = {},
): ProfilePerfWindow {
  const candidates = eligible
    .map((key) => byWindow[key])
    .filter((entry): entry is ProfileWindowStats => entry != null);

  const qualifying = candidates.filter((entry) => entry.qualifies);
  if (qualifying.length > 0) {
    return [...qualifying].sort(
      (a, b) =>
        b.stats.roi - a.stats.roi ||
        b.stats.units - a.stats.units ||
        b.graded - a.graded ||
        WIDEST_FIRST.indexOf(a.window) - WIDEST_FIRST.indexOf(b.window),
    )[0]!.window;
  }

  const fallback = WIDEST_FIRST.filter((key) => eligible.includes(key)).find(
    (key) => (byWindow[key]?.graded ?? 0) > 0,
  );

  return fallback ?? (eligible.includes("all") ? "all" : eligible[0]!);
}
