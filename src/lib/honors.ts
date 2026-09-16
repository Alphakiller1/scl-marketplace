import type { Outcome } from "@prisma/client";

import { etYmd, startOfEtYmd } from "@/lib/et-day";
import { CROSS_SPORTS, CROSS_SPORTS_LABEL } from "@/lib/parlay-sport";
import { computeCapperStats, type StatsBaseline } from "@/lib/stats";

/**
 * SCL Honors (Accolades) Program — awards for COMPLETED periods only.
 *
 * An award is granted once its period has ended: August's monthly awards on
 * September 1 (ET), a sport's season awards when that season's window closes,
 * a year's awards on January 1. The top performer must have positive units and
 * ROI and meet the program minimum, or no award is granted.
 *
 * Everything that decides who wins lives in the config below; the public
 * rules copy and minimums table are generated from it.
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
  /** Full name with its period: `2025 Capper of the Year`. */
  name: string;
  /** Award title without the period: `NFL Season Champion`. */
  title: string;
  /** Board chip, per the program: `2025 COTY`, `NFL25 ($)`, `AUG26 (%)`. */
  abbreviation: string;
  period: AwardPeriod;
  /** e.g. `2025`, `2026-27`, `2026-08`. Sorts chronologically as a string. */
  periodKey: string;
  /** Human label for the period: `2025`, `2025-26 season`, `August 2026`. */
  periodLabel: string;
  /** ISO instant the period ended — when the award was granted. */
  periodEnd: string;
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
 * A sport's season, in ET months: [start of `startMonth`, start of the month
 * after `endMonth`). An end month earlier than the start month crosses into
 * the next year.
 */
export type SeasonWindow = { startMonth: number; endMonth: number };

export type HonorSport = {
  key: string;
  /** Name used in award titles: `UFC`, `Soccer`. */
  label: string;
  /** Season chip prefix: `SOC` → `SOC26 ($)`. */
  abbr: string;
  seasonMinimum: number;
  monthlyMinimum: number;
  /** `null` = the season is the calendar year. */
  window: SeasonWindow | null;
};

const sport = (
  key: string,
  label: string,
  abbr: string,
  seasonMinimum: number,
  monthlyMinimum: number,
  window: SeasonWindow | null,
): HonorSport => ({
  key,
  label,
  abbr,
  seasonMinimum,
  monthlyMinimum,
  window,
});

/** Only these sports earn Honors, with the program's minimum settled picks. */
export const HONOR_SPORTS: readonly HonorSport[] = [
  sport("NFL", "NFL", "NFL", 50, 15, { startMonth: 8, endMonth: 2 }),
  sport("NCAAF", "NCAAF", "NCAAF", 50, 15, { startMonth: 8, endMonth: 1 }),
  sport("NBA", "NBA", "NBA", 150, 20, { startMonth: 10, endMonth: 6 }),
  sport("NCAAB", "NCAAB", "NCAAB", 100, 20, { startMonth: 11, endMonth: 4 }),
  sport("WNBA", "WNBA", "WNBA", 100, 15, { startMonth: 5, endMonth: 10 }),
  sport("MLB", "MLB", "MLB", 200, 25, { startMonth: 3, endMonth: 11 }),
  sport("MMA", "UFC", "UFC", 75, 15, null),
  sport("SOCCER", "Soccer", "SOC", 100, 20, null),
  sport("TENNIS", "Tennis", "TEN", 75, 15, null),
  sport("CFL", "CFL", "CFL", 40, 10, { startMonth: 6, endMonth: 11 }),
  sport("NHL", "NHL", "NHL", 100, 20, { startMonth: 10, endMonth: 6 }),
  sport("PGA", "PGA", "PGA", 50, 10, null),
];

const HONOR_SPORT_BY_KEY = new Map(HONOR_SPORTS.map((s) => [s.key, s]));

/** Capper of the Year and the Annual Performance Award. */
export const ANNUAL_MINIMUM = 250;
/** Cross Sport Parlay Allstar: settled Cross-Sports parlays in the month. */
export const CROSS_SPORTS_MINIMUM = 10;

export function honorMinimum(period: AwardPeriod, sportKey: string): number {
  if (sportKey === CROSS_SPORTS) return CROSS_SPORTS_MINIMUM;
  if (period === "annual") return ANNUAL_MINIMUM;
  const config = HONOR_SPORT_BY_KEY.get(sportKey);
  if (!config) return Number.POSITIVE_INFINITY;
  return period === "season" ? config.seasonMinimum : config.monthlyMinimum;
}

const CALENDAR_SEASON: SeasonWindow = { startMonth: 1, endMonth: 12 };

export function seasonWindowFor(sportKey: string): SeasonWindow {
  return HONOR_SPORT_BY_KEY.get(sportKey)?.window ?? CALENDAR_SEASON;
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

export function honorSportLabel(sportKey: string): string {
  if (sportKey === ALL_SPORTS) return "All Sports";
  if (sportKey === CROSS_SPORTS) return CROSS_SPORTS_LABEL;
  return HONOR_SPORT_BY_KEY.get(sportKey)?.label ?? sportKey;
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

export function seasonPeriod(
  sportKey: string,
  startYear: number,
): SeasonPeriod {
  const w = seasonWindowFor(sportKey);
  const crosses = w.endMonth < w.startMonth;
  const endYear = crosses ? startYear + 1 : startYear;
  return {
    sport: sportKey,
    startYear,
    key: crosses
      ? `${startYear}-${String(endYear).slice(-2)}`
      : String(startYear),
    start: monthStart(startYear, w.startMonth),
    end: monthStart(endYear, w.endMonth + 1),
  };
}

/** True while one of the sport's seasons is under way. */
export function sportInSeason(sportKey: string, now: Date): boolean {
  const year = Number(etYmd(now).slice(0, 4));
  return [year - 1, year].some((startYear) => {
    const season = seasonPeriod(sportKey, startYear);
    return (
      now.getTime() >= season.start.getTime() &&
      now.getTime() < season.end.getTime()
    );
  });
}

function monthAbbrev(year: number, month: number): string {
  return (
    MONTH_NAMES[month - 1]!.slice(0, 3).toUpperCase() + String(year).slice(-2)
  );
}

function metricMark(metric: AwardMetric): string {
  return metric === "units" ? "($)" : "(%)";
}

function metricTitle(metric: AwardMetric): string {
  return metric === "units" ? "(Units)" : "(ROI%)";
}

// ---------------------------------------------------------------------------
// Naming
// ---------------------------------------------------------------------------

export function annualAwardTitle(metric: AwardMetric): string {
  return metric === "units" ? "Capper of the Year" : "Annual Performance Award";
}

export function seasonAwardTitle(sportKey: string): string {
  return `${honorSportLabel(sportKey)} Season Champion`;
}

export function monthlyAwardTitle(sportKey: string): string {
  return sportKey === CROSS_SPORTS
    ? "Cross Sport Parlay Allstar"
    : `${honorSportLabel(sportKey)} Monthly Winner`;
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

/** One position of record (straight pick or whole parlay). */
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
  periodEnd: Date;
  sport: string;
  metrics: AwardMetric[];
  title: (metric: AwardMetric) => string;
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

const BOTH: AwardMetric[] = ["units", "roi"];

function annualBuckets(nowY: number): Bucket[] {
  const out: Bucket[] = [];
  for (let year = HONORS_LEGACY_YEAR; year < nowY; year++) {
    const start = monthStart(year, 1);
    const end = monthStart(year + 1, 1);
    const legacyYear = year === HONORS_LEGACY_YEAR;
    out.push({
      period: "annual",
      periodKey: String(year),
      periodLabel: String(year),
      periodEnd: end,
      sport: ALL_SPORTS,
      metrics: BOTH,
      title: annualAwardTitle,
      name: (metric) => `${year} ${annualAwardTitle(metric)}`,
      abbreviation: (metric) =>
        `${year} ${metric === "units" ? "COTY" : "ROI"}`,
      // The legacy year has no per-play history; its totals are the record.
      positions: (p) => !legacyYear && inRange(p.at, start, end),
      legacy: (row) =>
        row.sport === ALL_SPORTS &&
        (legacyYear
          ? row.scope === "YEAR_2025"
          : row.scope === "PRE_IMPORT" && year === HONORS_LEGACY_YEAR + 1),
    });
  }
  return out;
}

function seasonBuckets(
  sportKey: string,
  now: Date,
  nowY: number,
  legacyCaptured: Date,
): Bucket[] {
  const abbr = HONOR_SPORT_BY_KEY.get(sportKey)!.abbr;
  const title = () => seasonAwardTitle(sportKey);
  const yy = (year: number) => String(year).slice(-2);
  // The legacy site's "2025 season" was the 2025 calendar year per sport.
  const out: Bucket[] = [
    {
      period: "season",
      periodKey: String(HONORS_LEGACY_YEAR),
      periodLabel: `${HONORS_LEGACY_YEAR} season`,
      periodEnd: monthStart(HONORS_LEGACY_YEAR + 1, 1),
      sport: sportKey,
      metrics: BOTH,
      title,
      name: (metric) =>
        `${HONORS_LEGACY_YEAR} ${title()} ${metricTitle(metric)}`,
      abbreviation: (metric) =>
        `${abbr}${yy(HONORS_LEGACY_YEAR)} ${metricMark(metric)}`,
      positions: () => false,
      legacy: (row) => row.sport === sportKey && row.scope === "YEAR_2025",
    },
  ];
  // Platform seasons that start in or after the first platform year and have
  // finished. The early-2026 legacy residual belongs to a season only when
  // that season already covered it.
  for (let year = HONORS_LEGACY_YEAR + 1; year <= nowY; year++) {
    const season = seasonPeriod(sportKey, year);
    if (season.end.getTime() > now.getTime()) break;
    const foldsResidual =
      year === HONORS_LEGACY_YEAR + 1 &&
      season.start.getTime() <= legacyCaptured.getTime();
    out.push({
      period: "season",
      periodKey: season.key,
      periodLabel: `${season.key} season`,
      periodEnd: season.end,
      sport: sportKey,
      metrics: BOTH,
      title,
      name: (metric) => `${season.key} ${title()} ${metricTitle(metric)}`,
      abbreviation: (metric) => `${abbr}${yy(year)} ${metricMark(metric)}`,
      positions: (p) =>
        p.sport === sportKey && inRange(p.at, season.start, season.end),
      legacy: (row) =>
        foldsResidual && row.sport === sportKey && row.scope === "PRE_IMPORT",
    });
  }
  return out;
}

function monthlyBuckets(
  nowY: number,
  nowM: number,
  monthSports: readonly string[],
): Bucket[] {
  const out: Bucket[] = [];
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
    for (const sportKey of monthSports) {
      const cross = sportKey === CROSS_SPORTS;
      const title = () => monthlyAwardTitle(sportKey);
      out.push({
        period: "monthly",
        periodKey,
        periodLabel,
        periodEnd: end,
        sport: sportKey,
        // Cross Sport Parlay Allstar is a units award only.
        metrics: cross ? ["units"] : BOTH,
        title,
        name: (metric) =>
          cross
            ? `${periodLabel} ${title()}`
            : `${periodLabel} ${title()} ${metricTitle(metric)}`,
        abbreviation: (metric) =>
          `${monthAbbrev(year, month)} ${metricMark(metric)}`,
        positions: (p) => p.sport === sportKey && inRange(p.at, start, end),
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
  const sports = HONOR_SPORTS.map((s) => s.key).filter(
    (key) =>
      positions.some((p) => p.sport === key) ||
      legacy.some((row) => row.sport === key),
  );
  const hasCross = positions.some((p) => p.sport === CROSS_SPORTS);
  const positionsByCapper = groupBy(positions, (p) => p.capperId);
  const legacyByCapper = groupBy(legacy, (row) => row.capperId);

  const [nowY, nowM] = etYmd(now).split("-").map(Number) as [number, number];
  const legacyCaptured = startOfEtYmd(HONORS_LEGACY_CAPTURED);
  const allBuckets = [
    ...annualBuckets(nowY),
    ...sports.flatMap((key) => seasonBuckets(key, now, nowY, legacyCaptured)),
    ...monthlyBuckets(
      nowY,
      nowM,
      hasCross ? [...sports, CROSS_SPORTS] : sports,
    ),
  ];

  const awards: HonorAward[] = [];
  for (const bucket of allBuckets) {
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
        title: bucket.title(metric),
        abbreviation: bucket.abbreviation(metric),
        period: bucket.period,
        periodKey: bucket.periodKey,
        periodLabel: bucket.periodLabel,
        periodEnd: bucket.periodEnd.toISOString(),
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
      b.periodEnd.localeCompare(a.periodEnd) ||
      sportOrder(a.sport) - sportOrder(b.sport) ||
      (a.metric === b.metric ? 0 : a.metric === "units" ? -1 : 1),
  );
}

function sportOrder(sportKey: string): number {
  if (sportKey === ALL_SPORTS) return -1;
  const index = HONOR_SPORTS.findIndex((s) => s.key === sportKey);
  return index === -1 ? HONOR_SPORTS.length : index;
}

/**
 * What the boards feature right now, per the program's display rules:
 * - an annual award for the whole following calendar year;
 * - a season award for one month after its season ends, then again for the
 *   whole of the sport's next season (an NFL champion drops off after its
 *   grace month and returns when the next season starts in August);
 * - a monthly award for the whole following month.
 */
export function featuredHonors(
  awards: readonly HonorAward[],
  now = new Date(),
): Record<AwardPeriod, HonorAward[]> {
  const [nowY, nowM] = etYmd(now).split("-").map(Number) as [number, number];
  const lastYear = String(nowY - 1);
  const lastMonth =
    nowM === 1
      ? `${nowY - 1}-12`
      : `${nowY}-${String(nowM - 1).padStart(2, "0")}`;
  const latestSeason = new Map<string, string>();
  for (const award of awards) {
    if (
      award.period === "season" &&
      award.periodEnd > (latestSeason.get(award.sport) ?? "")
    ) {
      latestSeason.set(award.sport, award.periodEnd);
    }
  }
  const seasonVisible = (award: HonorAward) => {
    const [y, m] = etYmd(new Date(award.periodEnd)).split("-").map(Number) as [
      number,
      number,
    ];
    // Seasons end at the start of a month, so the grace month is that month.
    const graceEnd = monthStart(y, m + 1);
    return (
      now.getTime() < graceEnd.getTime() || sportInSeason(award.sport, now)
    );
  };
  return {
    annual: awards.filter(
      (a) => a.period === "annual" && a.periodKey === lastYear,
    ),
    season: awards.filter(
      (a) =>
        a.period === "season" &&
        a.periodEnd === latestSeason.get(a.sport) &&
        seasonVisible(a),
    ),
    monthly: awards.filter(
      (a) => a.period === "monthly" && a.periodKey === lastMonth,
    ),
  };
}

/** Everything featured, in board order: annual, season, monthly. */
export function featuredList(
  featured: Record<AwardPeriod, HonorAward[]>,
): HonorAward[] {
  return [...featured.annual, ...featured.season, ...featured.monthly];
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

export type HonorCriteriaRow = {
  sport: string;
  label: string;
  seasonMinimum: number;
  /** `Aug–Feb`, or `Calendar year`. */
  season: string;
  monthlyMinimum: number;
};

/** The minimums table on the Honors page, straight from the config. */
export function honorsCriteria(): HonorCriteriaRow[] {
  const short = (month: number) => MONTH_NAMES[month - 1]!.slice(0, 3);
  return HONOR_SPORTS.map((s) => ({
    sport: s.key,
    label: s.label,
    seasonMinimum: s.seasonMinimum,
    season: s.window
      ? `${short(s.window.startMonth)}–${short(s.window.endMonth)}`
      : "Calendar year",
    monthlyMinimum: s.monthlyMinimum,
  }));
}

/** Rules copy generated from the engine's own configuration. */
export function honorsRules(): { heading: string; lines: string[] }[] {
  return [
    {
      heading: "Annual Awards",
      lines: [
        "Capper of the Year: highest net units across all sports in the calendar year.",
        "Annual Performance Award: highest ROI across all sports in the calendar year.",
        `Minimum ${ANNUAL_MINIMUM} settled picks in the calendar year. Annual awards are featured for the entire following calendar year.`,
      ],
    },
    {
      heading: "Season Awards",
      lines: [
        "Season Champion (Units) and Season Champion (ROI%) are awarded per sport for that sport's season, with the minimums in the table below. UFC, Soccer, Tennis, and PGA seasons are the calendar year.",
        "Season awards are featured for one month after the season ends, and again for the whole of the sport's next season.",
        `The ${HONORS_LEGACY_YEAR} season awards use the ${HONORS_LEGACY_YEAR} records carried over from the previous platform.`,
      ],
    },
    {
      heading: "Monthly Awards",
      lines: [
        "Monthly Winner (Units) and Monthly Winner (ROI%) are awarded per sport for each calendar month, with the minimums in the table below. Monthly awards are featured for the entire following month.",
        `Cross Sport Parlay Allstar goes to the most net units from Cross-Sports parlays in the month (minimum ${CROSS_SPORTS_MINIMUM} settled Cross-Sports parlays). There is no ROI version.`,
      ],
    },
    {
      heading: "Eligibility",
      lines: [
        "An award is granted only after its period is complete, and never when the top performer's units or ROI are negative. Periods follow Eastern Time.",
        "Results use the same settled positions and sport attribution as the leaderboard. Every award stays in the capper's Trophy Case permanently.",
      ],
    },
  ];
}

export const DEFAULT_HONORS_INTRO =
  "SCL Honors recognizes the best verified results on SCL each year, each sport's season, and each month.";
