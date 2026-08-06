import { PROP_MARKET_LABEL } from "@/lib/odds-verify";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * Pure play↔result matching (no DB, no server-only) so it's unit-testable.
 * Resolves a play to an outcome from settled games, or `null` when it can't be
 * graded confidently (left PENDING for manual review). Handles moneyline,
 * spreads, and game totals.
 */
export type GradablePlay = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
  eventId?: string | null;
  side?: string | null;
  line?: number | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  /** Scheduled start, when the play was bound to a board event. */
  eventStartsAt?: Date | null;
  /**
   * Fallback date for scoping the name-matching pool. Imported legacy plays
   * carry the event time here (the extractor derives it from the legacy row's
   * date + time), so it is a reliable stand-in for eventStartsAt.
   */
  createdAt?: Date | null;
};

/**
 * Every market label the board stores for a player prop, normalized.
 *
 * The board writes the DISPLAY label ("Points"), not the Odds API key
 * ("player_points"), so the `market.includes("player")` test below never fired
 * for a board-entered prop. The stat-word test on the selection didn't catch
 * them either, because the board's prop selection text is `player side line`
 * ("Sabrina Ionescu Under 19.5") and names no stat.
 *
 * A prop that reaches `resolveOutcome` is graded as a GAME TOTAL: it sees
 * "under 19.5", adds the two final scores, and settles a 19.5-point player line
 * against a 178-point game. Both board props on record lost that way while
 * winning in reality.
 */
const PROP_MARKET_LABELS = new Set(
  Object.values(PROP_MARKET_LABEL).map((label) => norm(label)),
);

/** Player props / partial-game markets defer until a dedicated stats provider exists. */
export function isDeferredProp(play: GradablePlay): boolean {
  const market = norm(play.market);
  const selection = norm(play.selection);
  if (PROP_MARKET_LABELS.has(market)) return true;
  if (market.includes("prop") || market.includes("player")) return true;
  if (market.includes("inning") || selection.includes("first five"))
    return true;
  if (/\bf5\b/.test(selection) || selection.includes("innings")) return true;
  // A team total is not a game total. "Nationals TT O4.5" compared against both
  // teams' combined runs is a near-guaranteed spurious WIN.
  if (/\btt\b/.test(selection) || selection.includes("team total")) return true;
  if (
    /\b(points|rebounds|assists|yards|touchdowns|strikeouts|hits)\b/.test(
      selection,
    )
  ) {
    return true;
  }
  return false;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

/** Last tokens too generic to identify a club (e.g. American/National League). */
const WEAK_NICKNAMES = new Set([
  "league",
  "team",
  "club",
  "fc",
  "united",
  "city",
  "stars",
]);

function mentions(text: string, team: string): boolean {
  const t = norm(text);
  const tn = norm(team);
  if (!t || !tn) return false;
  if (t.includes(tn) || (tn.includes(t) && t.length >= 4)) return true;
  const parts = tn
    .split(" ")
    .filter((p) => p.length > 2 && !WEAK_NICKNAMES.has(p));
  const nickname = parts.at(-1);
  return !!nickname && t.includes(nickname);
}

/** Parse "Brewers vs Reds" / "PHI / PIT" style matchup prefixes. */
function parseMatchupSides(text: string): { a: string; b: string } | null {
  const vs = text.match(
    /^(.+?)\s+vs\.?\s+(.+?)(?:\s+(?:over|under|o|u)\b.*)?$/i,
  );
  if (vs?.[1] && vs[2]) {
    return { a: vs[1].trim(), b: vs[2].trim() };
  }
  const slash = text.match(
    /^([A-Za-z .]{2,20})\s*\/\s*([A-Za-z .]{2,20})(?:\s|$)/,
  );
  if (slash?.[1] && slash[2]) {
    return { a: slash[1].trim(), b: slash[2].trim() };
  }
  return null;
}

function teamsAreOpponents(a: string, b: string, game: SettledGame): boolean {
  const aHome = mentions(a, game.home);
  const aAway = mentions(a, game.away);
  const bHome = mentions(b, game.home);
  const bAway = mentions(b, game.away);
  return (aHome && bAway) || (aAway && bHome);
}

/**
 * How far a settled game's start may sit from the play's own event time and
 * still be considered the same fixture.
 *
 * This was 18h, which is almost exactly the gap between an afternoon game and
 * the previous evening's: a 14:10 ET play sits 18h from the 20:10 ET game the
 * night before, which is long final and sitting in the settled pool. Five
 * picks graded 2.2-2.8h after first pitch that way — mid-game, against the
 * wrong fixture — after the earlier scoping fix shipped.
 *
 * 4h still spans a doubleheader nightcap and imported timestamps that record
 * only the scheduled hour, while keeping the pool inside one fixture slot. A
 * genuinely postponed game now finds no match and waits for a later cron run,
 * which is the safe direction: PENDING is recoverable, a wrong public result
 * is not.
 */
const SAME_FIXTURE_WINDOW_MS = 4 * 60 * 60 * 1000;

/**
 * Restrict candidates to games plausibly on the same date as the play.
 *
 * Only applies when both sides carry a timestamp. If either is unknown we
 * cannot judge, so the full pool is returned and the caller behaves as before.
 */
function sameFixtureWindow(
  play: GradablePlay,
  games: SettledGame[],
): SettledGame[] {
  const when = play.eventStartsAt ?? play.createdAt;
  if (!when) return games;
  const anyDated = games.some((g) => g.startsAt);
  if (!anyDated) return games;
  return games.filter(
    (g) =>
      !g.startsAt ||
      Math.abs(g.startsAt.getTime() - when.getTime()) <= SAME_FIXTURE_WINDOW_MS,
  );
}

/**
 * One candidate, or none.
 *
 * Each name-matching tier used to take the first hit, so when two games in the
 * window both fit — a doubleheader, or two clubs sharing a nickname token —
 * the result was decided by the order the provider happened to return. A
 * coin-flip is not a track record: an ambiguous play stays PENDING for manual
 * review instead of publishing a guess.
 */
function sole(matches: SettledGame[]): SettledGame | null {
  return matches.length === 1 ? matches[0]! : null;
}

export function findGame(
  play: GradablePlay,
  games: SettledGame[],
): SettledGame | null {
  const bySport = games.filter((g) => g.sport === play.sport);

  // An event-bound play grades against that event or not at all.
  //
  // This used to fall through to the name matching below when the event was
  // absent from the settled set — which is exactly the case while the game is
  // still being played. The settled pool spans two weeks of scoreboard history,
  // so "Houston Astros" then matched a DIFFERENT, already-final Astros game and
  // graded a live pick with an old result: a bet settled WIN in the 3rd inning
  // at 0-0. Absent means not finished yet; the correct answer is to wait.
  if (play.eventId) {
    return bySport.find((g) => g.eventId === play.eventId) ?? null;
  }

  // Plays with no eventId — every imported legacy pick — still reach the name
  // matching below, where the same stale-pool hazard applies: a pick logged
  // today matched the first same-team game in a fortnight of history and
  // settled against a result from days earlier. Confirmed in production, where
  // 28 picks graded within 1.5-2h of first pitch, i.e. mid-game. Scoping to the
  // play's own date means an unfinished game simply finds no match and waits
  // for the next cron run, which is the intended behaviour.
  const sportGames = sameFixtureWindow(play, bySport);

  const matchup = parseMatchupSides(play.selection);
  if (matchup) {
    const both = sportGames.filter((g) =>
      teamsAreOpponents(matchup.a, matchup.b, g),
    );
    if (both.length) return sole(both);
  }

  const bySelection = sportGames.filter((g) => {
    const pickedHome =
      mentions(play.selection, g.home) || mentions(play.side ?? "", g.home);
    const pickedAway =
      mentions(play.selection, g.away) || mentions(play.side ?? "", g.away);
    return pickedHome !== pickedAway;
  });
  if (bySelection.length) return sole(bySelection);

  const byMarket = sportGames.filter(
    (g) => mentions(play.market, g.home) || mentions(play.market, g.away),
  );
  if (byMarket.length) return sole(byMarket);

  return null;
}

function parseSpreadFromSelection(
  selection: string,
): { team: string; line: number } | null {
  const match = selection.match(/^(.+?)\s*([+-]\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const team = match[1]!.trim();
  const line = Number(match[2]);
  if (!team || Number.isNaN(line)) return null;
  return { team, line };
}

function gradeSpread(
  game: SettledGame,
  pickedTeam: string,
  line: number,
): "WIN" | "LOSS" | "PUSH" | null {
  const pickedHome = mentions(pickedTeam, game.home);
  const pickedAway = mentions(pickedTeam, game.away);
  if (pickedHome === pickedAway) return null;

  const teamMargin = pickedHome
    ? game.homeScore - game.awayScore
    : game.awayScore - game.homeScore;
  const adjusted = teamMargin + line;
  if (adjusted === 0) return "PUSH";
  return adjusted > 0 ? "WIN" : "LOSS";
}

export function resolveOutcome(
  play: GradablePlay,
  games: SettledGame[],
): "WIN" | "LOSS" | "PUSH" | null {
  if (isDeferredProp(play)) return null;

  const market = norm(play.market);
  const selection = norm(play.selection);
  const game = findGame(play, games);
  if (!game) return null;

  // ---- totals (over/under a number) ----
  const totalMatch = play.selection
    .toLowerCase()
    .match(/\b(over|under|o|u)\b\D*(\d+(?:\.\d+)?)/);
  const isTotal =
    market.includes("total") || /\b(o|u|over|under)\b/.test(selection);
  if (totalMatch && isTotal) {
    const sideRaw = totalMatch[1]!;
    const side = sideRaw === "u" || sideRaw === "under" ? "under" : "over";
    const line = Number(totalMatch[2]);
    const total = game.homeScore + game.awayScore;
    if (total === line) return "PUSH";
    const over = total > line;
    return (side === "over") === over ? "WIN" : "LOSS";
  }

  // ---- spreads ----
  const isSpread =
    market.includes("spread") ||
    (play.line != null && play.side != null && !isTotal);
  if (isSpread) {
    const pickedTeam = play.side ?? play.selection;
    const line =
      play.line ?? parseSpreadFromSelection(play.selection)?.line ?? null;
    if (line == null || Number.isNaN(line)) return null;
    return gradeSpread(game, pickedTeam, line);
  }

  const spreadParsed = parseSpreadFromSelection(play.selection);
  if (
    spreadParsed &&
    (market.includes("spread") || /[+-]\d/.test(play.selection))
  ) {
    return gradeSpread(game, spreadParsed.team, spreadParsed.line);
  }

  // ---- moneyline (a team wins) ----
  const pickedHome =
    mentions(play.selection, game.home) || mentions(play.side ?? "", game.home);
  const pickedAway =
    mentions(play.selection, game.away) || mentions(play.side ?? "", game.away);
  if (pickedHome === pickedAway) return null;
  if (game.homeScore === game.awayScore) return "PUSH";
  const homeWon = game.homeScore > game.awayScore;
  return pickedHome === homeWon ? "WIN" : "LOSS";
}
