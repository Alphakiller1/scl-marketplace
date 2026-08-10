/**
 * Shared domain constants for SCL.
 * Mirrors the sport taxonomy and unit conventions of the existing market so
 * leaderboards map 1:1 and capper results stay comparable.
 */

// Canonical sports taxonomy (key + label). `key` is what we persist.
export const SPORTS = [
  { key: "NFL", label: "NFL" },
  { key: "NBA", label: "NBA" },
  { key: "NCAAF", label: "NCAA Football" },
  { key: "NCAAB", label: "NCAA Basketball" },
  { key: "MLB", label: "MLB" },
  { key: "NHL", label: "NHL" },
  { key: "WNBA", label: "WNBA" },
  { key: "SOCCER", label: "Soccer" },
  { key: "CFL", label: "CFL" },
  { key: "UFL", label: "UFL" },
  { key: "MMA", label: "MMA / UFC" },
  { key: "BOXING", label: "Boxing" },
  { key: "NASCAR", label: "NASCAR" },
  { key: "PGA", label: "PGA" },
  { key: "TENNIS", label: "Tennis" },
] as const;

export type SportKey = (typeof SPORTS)[number]["key"];
export const SPORT_KEYS = SPORTS.map((s) => s.key) as SportKey[];

// Cappers may use the quick chips or type their own stake. Keep this value in
// sync with the Decimal widths on Play/Parlay and their grading audit tables.
export const UNIT_MIN = 0.25;
export const UNIT_MAX = 100_000_000;
export const UNIT_STEP = 0.25;
/** Convenient defaults; these are not the full range accepted by the input. */
export const UNIT_QUICK_CHIPS = [0.5, 1, 2, 3, 4, 5] as const;

// Leaderboard timeframes (days; null = season/year handled separately).
export const LEADERBOARD_TIMEFRAMES = [
  { key: "7d", label: "Past 7 Days", days: 7 },
  { key: "30d", label: "Past 30 Days", days: 30 },
  { key: "60d", label: "Past 60 Days", days: 60 },
  { key: "90d", label: "Past 90 Days", days: 90 },
  { key: "season", label: "Current Season", days: null },
  { key: "year", label: "Current Year", days: null },
] as const;

// How leaderboards can be ranked (metric columns are click-to-sort).
export const LEADERBOARD_SORTS = [
  { key: "units", label: "Units" },
  { key: "roi", label: "ROI" },
  { key: "winPct", label: "Win%" },
  { key: "sample", label: "Sample" },
  { key: "form", label: "Form" },
  { key: "clv", label: "CLV" },
] as const;
