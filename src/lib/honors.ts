import type { Outcome } from "@prisma/client";

import { SPORTS } from "@/lib/constants";
import { etYmd, startOfEtYmd } from "@/lib/et-day";
import { CROSS_SPORTS, CROSS_SPORTS_LABEL } from "@/lib/parlay-sport";
import { computeCapperStats, type StatsBaseline } from "@/lib/stats";

/**
 * SCL Honors — awards for COMPLETED periods only.
 *
 * An award is granted once its period has ended: August's monthly awards
 * appear on September 1 (ET), a sport's season award once that season's window
 * closes, and a year's awards on January 1 of the next year. A winner must have
 * a positive result and meet the period's minimum settled sample.
 *
 * Everything that decides who wins — names, season windows, minimums — lives
 * in the config below, so the public rules copy is generated from the same
 * values the engine uses and the two cannot drift apart.
 */

export type AwardPeriod = "annual" | "season" | "monthly";
export type AwardMetric = "units" | "roi";

export const AWARD_PERIODS: readonly {
  key: AwardPeriod;
  label: string;
}[] = [
  { key: "annual", label: "Annual Awards" },
  { key: "season", label: "Season Awards" },
  { key: "monthly", label: "Monthly Awards" },
];

/** All-sports awards (the annual pair) use this sentinel sport key. */
export const ALL_SPORTS = "ALL";

export type HonorWinner = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  record: { w: number; l: number; p: number };
  settled: number;
  units: number;
  roi: number;
};

export type HonorAward = {
  /** Stable, URL-safe: `<period>-<periodKey>-<sport>-<metric>`. */
  id: string;
  name: string;
  /** Compact chip label, e.g. `AUG26 ($)`, `2025 (%)`. */
  abbreviation: string;
  period: AwardPeriod;
  /** e.g. `2025`, `2026-27`, `2026-08`. Sorts chronologically as a string. */
  periodKey: string;
  /** Human label for the period: `2025`, `2025-26 NBA season`, `August 2026`. */
  periodLabel: string;
  /** Canonical sport key, `ALL`, or `CROSS_SPORTS`. */
  sport: string;
  sportLabel: string;
  metric: AwardMetric;
  minimumPicks: number;
  winner: HonorWinner;
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Minimum settled picks by period, with optional per-sport overrides.
 * `cross` is the Cross Sport Parlay Allstar minimum (settled cross-sport
 * parlays in the month).
 */
export const HONOR_MINIMUMS: {
  annual: number;
  season: { default: number; bySport: Partial<Record<string, number>> };
  monthly: { default: number; bySport: Partial<Record<string, number>> };
  cross: number;
} = {
  annual: 50,
  season: { default: 25, bySport: {} },
  monthly: { default: 10, bySport: {} },
  cross: 10,
};

export function honorMinimum(period: AwardPeriod, sport: string): number {
  if (sport === CROSS_SPORTS) return HONOR_MINIMUMS.cross;
  if (period === "annual") return HONOR_MINIMUMS.annual;
  const table = HONOR_MINIMUMS[period];
  return table.bySport[sport] ?? table.default;
}

/**
 * A sport's season window, in ET months. `startMonth`/`endMonth` are 1-12 and
 * the window is [start of startMonth, start of the month AFTER endMonth).
 * A season whose end month is earlier in the calendar than its start month
 * crosses into the next year and is labelled `2026-27`.
 */
export type SeasonWindow = { startMonth: number; endMonth: number };

export const SEASON_WINDOWS: Record<string, SeasonWindow> = {
  MLB: { startMonth: 3, endMonth: 11 },
  WNBA: { startMonth: 5, endMonth: 10 },
  CFL: { startMonth: 6, endMonth: 11 },
  UFL: { startMonth: 3, endMonth: 6 },
  NFL: { startMonth: 9, endMonth: 2 },
  NCAAF: { startMonth: 8, endMonth: 1 },
  NBA: { startMonth: 10, endMonth: 6 },
  NHL: { startMonth: 10, endMonth: 6 },
  NCAAB: { startMonth: 11, endMonth: 4 },
};
/** Sports without a defined season (soccer, tennis, combat, golf, racing). */
const CALENDAR_SEASON: SeasonWindow = { startMonth: 1, endMonth: 12 };

export function seasonWindowFor(sport: string): SeasonWindow {
  return SEASON_WINDOWS[sport] ?? CALENDAR_SEASON;
}

/**
 * Per-play history starts with the imported slips (2026-04-18). Monthly awards
 * begin with the first complete month of that history.
 */
export const HONORS_FIRST_MONTH = "2026-05";
/** The legacy export, whose year totals carry 2025 and early 2026. */
export const HONORS_LEGACY_YEAR = 2025;
/** When the legacy `PRE_IMPORT` residual was captured. */
export const HONORS_LEGACY_CAPTURED = "2026-07-31";

const SPORT_LABELS: Record<string, string> = Object.fromEntries(
  SPORTS.map((s) => [s.key, s.label]),
);

export function honorSportLabel(sport: string): string {
  if (sport === ALL_SPORTS) return "All Sports";
  if (sport === CROSS_SPORTS) return CROSS_SPORTS_LABEL;
  return SPORT_LABELS[sport] ?? sport;
}

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// ---------------------------------------------------------------------------
// Period arithmetic (ET)
// ---------------------------------------------------------------------------

function monthStart(year: number, month: number): Date {
  const y = year + Math.floor((month - 1) / 12);
  const m = ((((month - 1) % 12) + 12) % 12) + 1;
  return startOfEtYmd(`${y}-${String(m).padStart(2, "0")}-01`);
}

export type SeasonPeriod = {
  sport: string;
  startYear: number;
  key: string;
  start: Date;
  end: Date;
};

export function seasonPeriod(sport: string, startYear: number): SeasonPeriod {
  const w = seasonWindowFor(sport);
  const crosses = w.endMonth < w.startMonth;
  const endYear = crosses ? startYear + 1 : startYear;
  return {
    sport,
    startYear,
    key: crosses
      ? `${startYear}-${String(endYear).slice(-2)}`
      : String(startYear),
    start: monthStart(startYear, w.startMonth),
    end: monthStart(endYear, w.endMonth + 1),
  };
}

function monthAbbrev(year: number, month: number): string {
  return (
    MONTH_NAMES[month - 1]!.slice(0, 3).toUpperCase() + String(year).slice(-2)
  );
}

function metricMark(metric: AwardMetric): string {
  return metric === "units" ? "($)" : "(%)";
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

export function annualAwardName(year: number, metric: AwardMetric): string {
  return metric === "units"
    ? `${year} Capper of the Year`
    : `${year} ROI Capper of the Year`;
}

export function seasonAwardName(
  seasonKey: string,
  sport: string,
  metric: AwardMetric,
): string {
  return `${seasonKey} ${honorSportLabel(sport)} Season ${metric === "units" ? "Units" : "ROI"} Champion`;
}

export function monthlyAwardName(
  year: number,
  month: number,
  sport: string,
  metric: AwardMetric,
): string {
  const when = `${MONTH_NAMES[month - 1]} ${year}`;
  if (sport === CROSS_SPORTS) return `${when} Cross Sport Parlay Allstar`;
  return `${when} ${honorSportLabel(sport)} ${metric === "units" ? "Units" : "ROI"} Champion`;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export type HonorCapper = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
};

/** One settled-or-not position of record (straight pick or whole parlay). */
export type HonorPosition = {
  capperId: string;
  /** Reporting sport: the play's sport, or the parlay's reporting sport. */
  sport: string;
  /** Slate instant — event start, else log time (leaderboard rule). */
  at: Date;
  outcome: Outcome;
  units: number;
  profitUnits: number | null;
};

/** Legacy year totals: `YEAR_2025` rows and the 2026 `PRE_IMPORT` residual. */
export type HonorLegacyTotal = {
  capperId: string;
  scope: "YEAR_2025" | "PRE_IMPORT";
  sport: string;
  wins: number;
  losses: number;
  pushes: number;
  unitsRisked: number;
  unitsNet: number;
};

type Bucket = {
  period: AwardPeriod;
  periodKey: string;
  periodLabel: string;
  sport: string;
  metrics: AwardMetric[];
  name: (metric: AwardMetric) => string;
  abbreviation: (metric: AwardMetric) => string;
  positions: (p: HonorPosition) => boolean;
  legacy: (row: HonorLegacyTotal) => boolean;
};

function baseline(rows: HonorLegacyTotal[]): StatsBaseline | null {
  let wins = 0;
  let losses = 0;
  let pushes = 0;
  let stakedUnits = 0;
  let units = 0;
  for (const row of rows) {
    wins += row.wins;
    losses += row.losses;
    pushes += row.pushes;
    stakedUnits += row.unitsRisked;
    units += row.unitsNet;
  }
  return wins + losses + pushes > 0
    ? { wins, losses, pushes, stakedUnits, units }
    : null;
}

function inRange(at: Date, start: Date, end: Date): boolean {
  const t = at.getTime();
  return t >= start.getTime() && t < end.getTime();
}

function rankWinner(
  bucket: Bucket,
  metric: AwardMetric,
  cappers: ReadonlyMap<string, HonorCapper>,
  positionsByCapper: ReadonlyMap<string, HonorPosition[]>,
  legacyByCapper: ReadonlyMap<string, HonorLegacyTotal[]>,
): HonorWinner | null {
  const minimum = honorMinimum(bucket.period, bucket.sport);
  let best: HonorWinner | null = null;
  for (const capper of cappers.values()) {
    const plays = (positionsByCapper.get(capper.id) ?? []).filter(
      bucket.positions,
    );
    const carried = baseline(
      (legacyByCapper.get(capper.id) ?? []).filter(bucket.legacy),
    );
    if (!plays.length && !carried) continue;
    const stats = computeCapperStats(plays, carried);
    // Positive results only: a losing record never takes an award, including
    // an ROI award won on a small positive stake.
    if (stats.settled < minimum || stats.units <= 0 || stats.roi <= 0) {
      continue;
    }
    const candidate: HonorWinner = {
      ...capper,
      record: { w: stats.wins, l: stats.losses, p: stats.pushes },
      settled: stats.settled,
      units: Math.round(stats.units * 100) / 100,
      roi: Math.round(stats.roi * 100) / 100,
    };
    if (!best || beats(candidate, best, metric)) best = candidate;
  }
  return best;
}

function beats(a: HonorWinner, b: HonorWinner, metric: AwardMetric): boolean {
  const primary = metric === "units" ? a.units - b.units : a.roi - b.roi;
  if (primary !== 0) return primary > 0;
  if (a.settled !== b.settled) return a.settled > b.settled;
  return a.handle.localeCompare(b.handle) < 0;
}

function buckets(
  now: Date,
  sports: readonly string[],
  hasCross: boolean,
): Bucket[] {
  const [nowY, nowM] = etYmd(now).split("-").map(Number) as [number, number];
  const legacyCaptured = startOfEtYmd(HONORS_LEGACY_CAPTURED);
  const out: Bucket[] = [];
  const both: AwardMetric[] = ["units", "roi"];

  // Annual: every completed calendar year since the legacy year.
  for (let year = HONORS_LEGACY_YEAR; year < nowY; year++) {
    const start = monthStart(year, 1);
    const end = monthStart(year + 1, 1);
    const legacyYear = year === HONORS_LEGACY_YEAR;
    out.push({
      period: "annual",
      periodKey: String(year),
      periodLabel: String(year),
      sport: ALL_SPORTS,
      metrics: both,
      name: (metric) => annualAwardName(year, metric),
      abbreviation: (metric) => `${year} ${metricMark(metric)}`,
      // The legacy year has no per-play history; its totals are the record.
      positions: (p) => !legacyYear && inRange(p.at, start, end),
      legacy: (row) =>
        row.sport === ALL_SPORTS &&
        (legacyYear
          ? row.scope === "YEAR_2025"
          : row.scope === "PRE_IMPORT" && year === HONORS_LEGACY_YEAR + 1),
    });
  }

  for (const sport of sports) {
    // The legacy site's "2025 season" was the 2025 calendar year per sport.
    out.push({
      period: "season",
      periodKey: String(HONORS_LEGACY_YEAR),
      periodLabel: `${HONORS_LEGACY_YEAR} ${honorSportLabel(sport)} season`,
      sport,
      metrics: both,
      name: (metric) =>
        seasonAwardName(String(HONORS_LEGACY_YEAR), sport, metric),
      abbreviation: (metric) =>
        `${sport} ${HONORS_LEGACY_YEAR} ${metricMark(metric)}`,
      positions: () => false,
      legacy: (row) => row.sport === sport && row.scope === "YEAR_2025",
    });
    // Platform seasons: those that start in or after the first platform year
    // and have finished. The early-2026 legacy residual belongs to a season
    // only when that season already covered it.
    for (let year = HONORS_LEGACY_YEAR + 1; year <= nowY; year++) {
      const season = seasonPeriod(sport, year);
      if (season.end.getTime() > now.getTime()) break;
      const foldsResidual =
        year === HONORS_LEGACY_YEAR + 1 &&
        season.start.getTime() <= legacyCaptured.getTime();
      out.push({
        period: "season",
        periodKey: season.key,
        periodLabel: `${season.key} ${honorSportLabel(sport)} season`,
        sport,
        metrics: both,
        name: (metric) => seasonAwardName(season.key, sport, metric),
        abbreviation: (metric) =>
          `${sport} ${season.key} ${metricMark(metric)}`,
        positions: (p) =>
          p.sport === sport && inRange(p.at, season.start, season.end),
        legacy: (row) =>
          foldsResidual && row.sport === sport && row.scope === "PRE_IMPORT",
      });
    }
  }

  // Monthly: every completed ET month since per-play history began.
  const [firstY, firstM] = HONORS_FIRST_MONTH.split("-").map(Number) as [
    number,
    number,
  ];
  for (
    let index = firstY * 12 + firstM - 1;
    index < nowY * 12 + nowM - 1;
    index++
  ) {
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    const start = monthStart(year, month);
    const end = monthStart(year, month + 1);
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;
    const periodLabel = `${MONTH_NAMES[month - 1]} ${year}`;
    const monthSports = hasCross ? [...sports, CROSS_SPORTS] : sports;
    for (const sport of monthSports) {
      const cross = sport === CROSS_SPORTS;
      out.push({
        period: "monthly",
        periodKey,
        periodLabel,
        sport,
        // Cross Sport Parlay Allstar is a units award only.
        metrics: cross ? ["units"] : both,
        name: (metric) => monthlyAwardName(year, month, sport, metric),
        abbreviation: (metric) =>
          `${cross ? "" : `${sport} `}${monthAbbrev(year, month)} ${metricMark(metric)}`,
        positions: (p) => p.sport === sport && inRange(p.at, start, end),
        legacy: () => false,
      });
    }
  }
  return out;
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

/** Every award earned in every completed period, newest period first. */
export function computeHonors(input: {
  cappers: readonly HonorCapper[];
  positions: readonly HonorPosition[];
  legacy: readonly HonorLegacyTotal[];
  now?: Date;
}): HonorAward[] {
  const now = input.now ?? new Date();
  const cappers = new Map(input.cappers.map((c) => [c.id, c]));
  const positions = input.positions.filter((p) => cappers.has(p.capperId));
  const legacy = input.legacy.filter((row) => cappers.has(row.capperId));
  const sports = SPORTS.map((s) => s.key).filter(
    (sport) =>
      positions.some((p) => p.sport === sport) ||
      legacy.some((row) => row.sport === sport),
  );
  const hasCross = positions.some((p) => p.sport === CROSS_SPORTS);
  const positionsByCapper = groupBy(positions, (p) => p.capperId);
  const legacyByCapper = groupBy(legacy, (row) => row.capperId);

  const awards: HonorAward[] = [];
  for (const bucket of buckets(now, sports, hasCross)) {
    for (const metric of bucket.metrics) {
      const winner = rankWinner(
        bucket,
        metric,
        cappers,
        positionsByCapper,
        legacyByCapper,
      );
      if (!winner) continue;
      awards.push({
        id: `${bucket.period}-${bucket.periodKey}-${bucket.sport.toLowerCase()}-${metric}`,
        name: bucket.name(metric),
        abbreviation: bucket.abbreviation(metric),
        period: bucket.period,
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        sport: bucket.sport,
        sportLabel: honorSportLabel(bucket.sport),
        metric,
        minimumPicks: honorMinimum(bucket.period, bucket.sport),
        winner,
      });
    }
  }
  return awards.sort(
    (a, b) =>
      b.periodKey.localeCompare(a.periodKey) ||
      sportOrder(a.sport) - sportOrder(b.sport) ||
      (a.metric === b.metric ? 0 : a.metric === "units" ? -1 : 1),
  );
}

function sportOrder(sport: string): number {
  if (sport === ALL_SPORTS) return -1;
  const index = SPORTS.findIndex((s) => s.key === sport);
  return index === -1 ? SPORTS.length : index;
}

/**
 * The featured set: the most recent completed period in each column —
 * the latest year, each sport's latest completed season, and the latest month.
 */
export function featuredHonors(
  awards: readonly HonorAward[],
): Record<AwardPeriod, HonorAward[]> {
  const latestSeason = new Map<string, string>();
  let latestYear = "";
  let latestMonth = "";
  for (const award of awards) {
    if (award.period === "annual" && award.periodKey > latestYear) {
      latestYear = award.periodKey;
    }
    if (award.period === "monthly" && award.periodKey > latestMonth) {
      latestMonth = award.periodKey;
    }
    if (
      award.period === "season" &&
      award.periodKey > (latestSeason.get(award.sport) ?? "")
    ) {
      latestSeason.set(award.sport, award.periodKey);
    }
  }
  return {
    annual: awards.filter(
      (a) => a.period === "annual" && a.periodKey === latestYear,
    ),
    season: awards.filter(
      (a) => a.period === "season" && a.periodKey === latestSeason.get(a.sport),
    ),
    monthly: awards.filter(
      (a) => a.period === "monthly" && a.periodKey === latestMonth,
    ),
  };
}

export function awardsForCapper(
  awards: readonly HonorAward[],
  capperId: string,
): HonorAward[] {
  return awards.filter((award) => award.winner.id === capperId);
}

export function honorResultValue(award: HonorAward): number {
  return award.metric === "units" ? award.winner.units : award.winner.roi;
}

/** Rules copy generated from the engine's own configuration. */
export function honorsRules(): { heading: string; lines: string[] }[] {
  const seasonMin = HONOR_MINIMUMS.season;
  const monthlyMin = HONOR_MINIMUMS.monthly;
  const overrides = (bySport: Partial<Record<string, number>>) => {
    const entries = Object.entries(bySport);
    return entries.length
      ? ` (${entries.map(([s, n]) => `${honorSportLabel(s)} ${n}`).join(", ")})`
      : "";
  };
  const seasonLines = SPORTS.filter((s) => SEASON_WINDOWS[s.key]).map((s) => {
    const w = SEASON_WINDOWS[s.key]!;
    return `${s.label}: ${MONTH_NAMES[w.startMonth - 1]} through ${MONTH_NAMES[w.endMonth - 1]}.`;
  });
  return [
    {
      heading: "When awards are granted",
      lines: [
        "Awards are granted only after their period is complete. A month's awards appear once that calendar month ends, a sport's season awards once that season ends, and a year's awards once the calendar year ends.",
        "Only cappers with a positive result are eligible. Periods and months follow Eastern Time.",
      ],
    },
    {
      heading: "Annual Awards",
      lines: [
        "YYYY Capper of the Year: the most net units across all sports for the calendar year.",
        "YYYY ROI Capper of the Year: the highest ROI across all sports for the calendar year.",
        `Minimum ${HONOR_MINIMUMS.annual} settled picks.`,
      ],
    },
    {
      heading: "Season Awards",
      lines: [
        "Season Units Champion and Season ROI Champion are awarded per sport, for that sport's season.",
        `Minimum ${seasonMin.default} settled picks in the sport${overrides(seasonMin.bySport)}.`,
        ...seasonLines,
        "Sports without a set season use the calendar year. The 2025 season awards use the 2025 records carried over from the previous platform.",
      ],
    },
    {
      heading: "Monthly Awards",
      lines: [
        "Monthly Units Champion and Monthly ROI Champion are awarded per sport for each calendar month.",
        `Minimum ${monthlyMin.default} settled picks in the sport${overrides(monthlyMin.bySport)}.`,
        `Cross Sport Parlay Allstar goes to the most net units from Cross-Sports parlays in the month. Minimum ${HONOR_MINIMUMS.cross} settled Cross-Sports parlays. There is no ROI version of this award.`,
      ],
    },
    {
      heading: "Results",
      lines: [
        "Results use the same settled positions and sport attribution as the leaderboard. Each award records its metric, sport, minimum sample, and winning result, and stays in the capper's Trophy Case permanently.",
      ],
    },
  ];
}

export const DEFAULT_HONORS_INTRO =
  "SCL Honors recognizes the best verified results on SCL each year, each sport's season, and each month.";
