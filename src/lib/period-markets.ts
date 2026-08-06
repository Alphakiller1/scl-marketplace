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

/** Odds API key → stored label, for every segment/kind combination. */
export const PERIOD_MARKET_LABEL: Record<string, string> = Object.fromEntries(
  PERIOD_INNINGS.flatMap((innings) =>
    (Object.keys(KIND_LABEL) as PeriodMarketKind[]).map((kind) => [
      periodMarketKey(innings, kind),
      periodMarketLabel(innings, kind),
    ]),
  ),
);

/** Every period market key requested for a sport ([] when it has none). */
export function periodMarketKeysForSport(sclSport: string): string[] {
  if (!PERIOD_SPORTS.has(sclSport.trim().toUpperCase())) return [];
  return Object.keys(PERIOD_MARKET_LABEL);
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

  const innings = /first[\s-]?five|\bf5\b/.test(m)
    ? 5
    : /first[\s-]?three|\bf3\b/.test(m)
      ? 3
      : /first[\s-]?seven|\bf7\b/.test(m)
        ? 7
        : Number(m.match(/(?:1st|first)[\s-]?(\d+)\s*innings?/)?.[1] ?? NaN);
  if (!Number.isFinite(innings) || innings < 1 || innings > 9) return null;

  const kind: PeriodMarketKind | null = /\bmoneyline\b|\bml\b/.test(m)
    ? "moneyline"
    : /\bspread\b|\brun\s?line\b/.test(m)
      ? "spread"
      : /\btotal\b/.test(m)
        ? "total"
        : null;

  return { innings, kind };
}

/** True when this market must NOT be settled from a full-game final score. */
export function isPeriodMarket(market: string | null | undefined): boolean {
  return parsePeriodMarket(market) != null;
}

/** Odds API key → the keys to price it against (period markets have no alternates). */
export function periodMarketKeysForLabel(label: string): string[] | null {
  const parsed = parsePeriodMarket(label);
  if (!parsed?.kind) return null;
  const innings = parsed.innings as PeriodInnings;
  if (!PERIOD_INNINGS.includes(innings)) return null;
  return [periodMarketKey(innings, parsed.kind)];
}
