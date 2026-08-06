/**
 * Partial-game (first-N-innings) markets — F3 / F5 / F7.
 *
 * One source of truth shared by the board (what a capper can log), verification
 * (which Odds API keys price it) and grading (how it settles). They MUST agree:
 * a period pick whose market label grading fails to recognize is settled against
 * the FULL-GAME result, which silently writes a wrong W/L onto a public record.
 * That is exactly what happened before these markets existed — an F5 moneyline
 * had nowhere to go but "Moneyline".
 *
 * Pure — no network, no server-only, unit-testable.
 */

/** Innings segments SCL offers. Baseball only; the Odds API has no F-N elsewhere. */
export const PERIOD_INNINGS = [3, 5, 7] as const;
export type PeriodInnings = (typeof PERIOD_INNINGS)[number];

export type PeriodMarketKind = "moneyline" | "spread" | "total";

/** Sports with first-N-innings markets on the Odds API. */
const PERIOD_SPORTS = new Set(["MLB"]);

/** Halves SCL offers. */
export const PERIOD_HALVES = [1, 2] as const;
export type PeriodHalf = (typeof PERIOD_HALVES)[number];

/**
 * Sports with half markets on the Odds API.
 *
 * Requested for CFL first, but the market keys are identical across the clock
 * sports, so withholding them from the rest would be an arbitrary gap.
 */
const HALF_SPORTS = new Set(["CFL", "NFL", "NCAAF", "NBA", "NCAAB", "WNBA"]);

const KIND_LABEL: Record<PeriodMarketKind, string> = {
  moneyline: "Moneyline",
  spread: "Spread",
  total: "Total",
};

/** Odds API market key for a segment, e.g. (5, "spread") → spreads_1st_5_innings. */
export function periodMarketKey(
  innings: PeriodInnings,
  kind: PeriodMarketKind,
): string {
  const prefix =
    kind === "moneyline" ? "h2h" : kind === "spread" ? "spreads" : "totals";
  return `${prefix}_1st_${innings}_innings`;
}

/**
 * Stored `market` label, e.g. "1st 5 Innings Moneyline".
 *
 * Spelled out rather than "F5 ML" on purpose: the label is what grading reads,
 * and it must be unmistakably a period market to anything doing substring checks
 * (`isDeferredProp` keys off "inning"). Display can abbreviate; storage does not.
 */
export function periodMarketLabel(
  innings: PeriodInnings,
  kind: PeriodMarketKind,
): string {
  return `1st ${innings} Innings ${KIND_LABEL[kind]}`;
}

/** Short form for tight UI (chips, slip rows): "F5 ML". */
export function periodMarketShortLabel(
  innings: PeriodInnings,
  kind: PeriodMarketKind,
): string {
  const k =
    kind === "moneyline" ? "ML" : kind === "spread" ? "Spread" : "Total";
  return `F${innings} ${k}`;
}

/** Odds API market key for a half, e.g. (1, "total") → totals_h1. */
export function halfMarketKey(
  half: PeriodHalf,
  kind: PeriodMarketKind,
): string {
  const prefix =
    kind === "moneyline" ? "h2h" : kind === "spread" ? "spreads" : "totals";
  return `${prefix}_h${half}`;
}

/** Stored `market` label for a half, e.g. "1st Half Moneyline". */
export function halfMarketLabel(
  half: PeriodHalf,
  kind: PeriodMarketKind,
): string {
  return `${half === 1 ? "1st" : "2nd"} Half ${KIND_LABEL[kind]}`;
}

/**
 * Compact segment label for chips and slip rows: "F5 ML", "H1 Spread".
 *
 * Derived from the stored market rather than a segment number, because a half
 * has no innings count — passing its 0 through the innings formatter rendered
 * "F0 ML" on every CFL half line.
 */
export function segmentShortLabel(market: string): string {
  const parsed = parsePeriodMarket(market);
  if (!parsed) return market;
  const kind =
    parsed.kind === "moneyline"
      ? "ML"
      : parsed.kind === "spread"
        ? "Spread"
        : "Total";
  if (parsed.innings > 0) return `F${parsed.innings} ${kind}`;
  const half = /\b(2nd|second)\s*half\b|\bh2\b/i.test(market) ? 2 : 1;
  return `H${half} ${kind}`;
}

/** Odds API key → stored label, for every segment/kind combination. */
export const PERIOD_MARKET_LABEL: Record<string, string> = Object.fromEntries([
  ...PERIOD_INNINGS.flatMap((innings) =>
    (Object.keys(KIND_LABEL) as PeriodMarketKind[]).map((kind) => [
      periodMarketKey(innings, kind),
      periodMarketLabel(innings, kind),
    ]),
  ),
  ...PERIOD_HALVES.flatMap((half) =>
    (Object.keys(KIND_LABEL) as PeriodMarketKind[]).map((kind) => [
      halfMarketKey(half, kind),
      halfMarketLabel(half, kind),
    ]),
  ),
]);

/** Every period market key requested for a sport ([] when it has none). */
export function periodMarketKeysForSport(sclSport: string): string[] {
  const sport = sclSport.trim().toUpperCase();
  const keys: string[] = [];
  if (PERIOD_SPORTS.has(sport)) {
    for (const innings of PERIOD_INNINGS) {
      for (const kind of Object.keys(KIND_LABEL) as PeriodMarketKind[]) {
        keys.push(periodMarketKey(innings, kind));
      }
    }
  }
  if (HALF_SPORTS.has(sport)) {
    for (const half of PERIOD_HALVES) {
      for (const kind of Object.keys(KIND_LABEL) as PeriodMarketKind[]) {
        keys.push(halfMarketKey(half, kind));
      }
    }
  }
  return keys;
}

/**
 * Read a stored `market` label back into its segment + kind.
 *
 * Accepts SCL's own labels and the shapes legacy imports produced ("First Five
 * Innings", "F5"), so a carried-over pick is recognized as a period market
 * rather than being mistaken for a full-game one. Returns null when the market
 * is not confidently a period market — callers must then treat it as full game.
 */
export function parsePeriodMarket(
  market: string | null | undefined,
): { innings: number; kind: PeriodMarketKind | null } | null {
  const m = (market ?? "").toLowerCase();
  if (!m) return null;

  const half = /\b(1st|first)\s*half\b|\bh1\b/.test(m)
    ? 1
    : /\b(2nd|second)\s*half\b|\bh2\b/.test(m)
      ? 2
      : null;

  const innings = /first[\s-]?five|\bf5\b/.test(m)
    ? 5
    : /first[\s-]?three|\bf3\b/.test(m)
      ? 3
      : /first[\s-]?seven|\bf7\b/.test(m)
        ? 7
        : Number(m.match(/(?:1st|first)[\s-]?(\d+)\s*innings?/)?.[1] ?? NaN);
  if (
    half == null &&
    (!Number.isFinite(innings) || innings < 1 || innings > 9)
  ) {
    return null;
  }

  const kind: PeriodMarketKind | null = /\bmoneyline\b|\bml\b/.test(m)
    ? "moneyline"
    : /\bspread\b|\brun\s?line\b/.test(m)
      ? "spread"
      : /\btotal\b/.test(m)
        ? "total"
        : null;

  // `innings: 0` marks a segment that is NOT an innings count. Grading keys off
  // a positive value, so halves are recognised as partial-game markets — and so
  // never settled on a full-game score — while still deferring until football
  // and basketball line-scores are wired up.
  return { innings: half == null ? innings : 0, kind };
}

/** True when this market must NOT be settled from a full-game final score. */
export function isPeriodMarket(market: string | null | undefined): boolean {
  return parsePeriodMarket(market) != null;
}

/** Odds API key → the keys to price it against (period markets have no alternates). */
export function periodMarketKeysForLabel(label: string): string[] | null {
  const parsed = parsePeriodMarket(label);
  if (!parsed?.kind) return null;

  // A half carries no innings count, so it is priced against its own key —
  // without this it fell through to the raw label, which prices nothing and
  // silently downgraded every half pick to SELF_REPORTED.
  if (parsed.innings === 0) {
    const half = /\b(2nd|second)\s*half\b|\bh2\b/i.test(label) ? 2 : 1;
    return [halfMarketKey(half as PeriodHalf, parsed.kind)];
  }

  const innings = parsed.innings as PeriodInnings;
  if (!PERIOD_INNINGS.includes(innings)) return null;
  return [periodMarketKey(innings, parsed.kind)];
}
