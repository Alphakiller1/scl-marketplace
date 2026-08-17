/**
 * Team totals — "Yankees Over 4.5", one club's runs rather than the game's.
 *
 * One source of truth shared by the board (what a capper can log), verification
 * (which Odds API keys price it) and grading (how it settles). They MUST agree,
 * for a sharper reason than the other markets: the stored label contains the
 * word "total", and the generic totals resolver keys off exactly that substring
 * and compares against `homeScore + awayScore`. A team total that reaches it
 * settles against BOTH clubs' runs — "Nationals Over 4.5" graded on a 3-2 game
 * is a WIN on 5 combined runs the capper never bet. Near-guaranteed spurious
 * wins, written onto a public verified record.
 *
 * So the label is matched exactly here, and grading resolves team totals before
 * it ever reaches the game-total branch.
 *
 * Pure — no network, no server-only, unit-testable.
 */

/**
 * Odds API market keys. The featured key carries the main line per club; the
 * alternate key carries the ladder around it, the same split as spreads and
 * totals — so both are requested or the board shows a single line where the
 * book shows eight.
 */
export const TEAM_TOTAL_MARKET_KEYS = [
  "team_totals",
  "alternate_team_totals",
] as const;

/** Stored `market` label. Display may abbreviate to "TT"; storage never does. */
export const TEAM_TOTAL_LABEL = "Team Total";

/** Exact match, not a substring: "Total" and "1st 5 Innings Total" are not this. */
export function isTeamTotalMarket(market: string): boolean {
  return market.trim().toLowerCase() === TEAM_TOTAL_LABEL.toLowerCase();
}

/**
 * Rungs the board always shows when the feed prices them (OWNER decision).
 *
 * 2.5 is the team total cappers ask for by name, and it was the one rung the
 * collapsed board could never show. Every team-total rung arrives
 * `featured: false` — the feed flags only full-game lines — so the ladder has
 * no main line to sort around and falls back to plain ascending order. 0.5 and
 * 1.5 for both clubs fill all eight collapsed slots, which puts 2.5 first in
 * the hidden tail: fetched and billed on every event, reachable only behind
 * "Show all".
 *
 * Pinned by line value rather than by sport, so the rung appears wherever a
 * book prices it and nothing extra appears where none does.
 */
export const PINNED_TEAM_TOTAL_LINES: readonly number[] = [2.5];

/** Is this a rung the collapsed board must keep visible? Both sides pin. */
export function isPinnedTeamTotalLine(
  market: string,
  line: number | undefined,
): boolean {
  if (!isTeamTotalMarket(market)) return false;
  return typeof line === "number" && PINNED_TEAM_TOTAL_LINES.includes(line);
}

export type TeamTotalSide = "Over" | "Under";

/** Canonical selection text, e.g. `New York Yankees Over 4.5`. */
export function teamTotalSelectionText(
  team: string,
  side: string,
  line: number,
): string {
  const normalizedSide: TeamTotalSide = /^u/i.test(side.trim())
    ? "Under"
    : "Over";
  return `${team.trim()} ${normalizedSide} ${line}`;
}

/**
 * Read a canonical team-total selection back apart.
 *
 * Deliberately strict: it accepts only what {@link teamTotalSelectionText}
 * writes. A free-text legacy pick ("Nats TT O4.5") returns null and stays
 * deferred, because guessing which club a loose abbreviation names is exactly
 * how a wrong result gets written.
 */
export function parseTeamTotalSelection(
  selection: string,
): { team: string; side: TeamTotalSide; line: number } | null {
  const match = selection
    .trim()
    .match(/^(.+?)\s+(Over|Under)\s+(\d+(?:\.\d+)?)$/i);
  if (!match) return null;
  const team = match[1]!.trim();
  const line = Number(match[3]);
  if (!team || !Number.isFinite(line)) return null;
  return {
    team,
    side: /^u/i.test(match[2]!) ? "Under" : "Over",
    line,
  };
}

/**
 * The `description` an Odds API outcome must carry for this pick.
 *
 * The provider puts the PLAYER there for a prop and the CLUB there for a team
 * total, and `collectAvailablePrices` only filters on it when a value is given.
 * A team total stores its club in the selection text and leaves `player` empty,
 * so nothing was filtering: the matcher took the first `Over 2.5` in the
 * team_totals market, and BOTH clubs have one. A Red Sox line tapped at -650 was
 * re-priced against the opponent's -650-shaped counterpart at -154 and written
 * as -154 — a real inflation of the capper's record, reported by the capper.
 *
 * Returning the club here is what makes the lookup name the same side the capper
 * tapped.
 */
export function outcomeDescriptionFor(pick: {
  market: string;
  selection: string;
  player?: string | null;
}): string | undefined {
  if (isTeamTotalMarket(pick.market)) {
    return parseTeamTotalSelection(pick.selection)?.team;
  }
  return pick.player?.trim() || undefined;
}
