import { PROP_MARKET_LABEL } from "@/lib/odds-verify";
import { isPeriodMarket } from "@/lib/period-markets";
import { resolveKnownTeam } from "@/lib/teams";
import {
  isTeamTotalMarket,
  parseTeamTotalSelection,
} from "@/lib/team-total-markets";
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
  /** Board fixture label, normally "Away @ Home". */
  eventLabel?: string | null;
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
  // A first-N-innings market must never fall through to the full-game
  // resolver — settling an F5 pick on the 9-inning final writes a result the
  // capper never bet. Explicit rather than relying on the substring rules below.
  if (isPeriodMarket(play.market)) return true;
  if (market.includes("prop") || market.includes("player")) return true;
  if (market.includes("inning") || selection.includes("first five"))
    return true;
  if (/\bf5\b/.test(selection) || selection.includes("innings")) return true;
  // A team total is not a game total. "Nationals TT O4.5" compared against both
  // teams' combined runs is a near-guaranteed spurious WIN.
  //
  // A board-written team total now settles properly against the named club's own
  // score, so it is NOT deferred — but only in the canonical form the board
  // writes. Free text that merely looks like one still is: resolving "TT" to a
  // club by guesswork is how the spurious win gets written anyway.
  if (isTeamTotalMarket(play.market)) {
    return parseTeamTotalSelection(play.selection) === null;
  }
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
  // Two MLB clubs end in "Sox", so the last-token fallback matched BOTH sides of
  // a White Sox @ Red Sox game and the matcher correctly refused to pick one.
  // Dropping it promotes the distinguishing word — "red" vs "white".
  "sox",
]);

/**
 * Does a play's text name this club, including by abbreviation?
 *
 * The name-shape rules below never matched an abbreviation: "TBR -147" shares no
 * substring with "Tampa Bay Rays" and its nickname "rays" appears nowhere in it.
 * The legacy platform writes abbreviations for some cappers, so those picks found
 * no game at all and sat PENDING indefinitely rather than failing loudly.
 *
 * Abbreviations resolve through the shared team registry — a strict, exact
 * lookup over each club's canonical abbr and aliases — so a short token only
 * matches when it is genuinely that club's code, never by coincidence.
 */
function mentions(text: string, team: string, sport?: string): boolean {
  const t = norm(text);
  const tn = norm(team);
  if (!t || !tn) return false;
  if (t.includes(tn) || (tn.includes(t) && t.length >= 4)) return true;
  const parts = tn
    .split(" ")
    .filter((p) => p.length > 2 && !WEAK_NICKNAMES.has(p));
  const nickname = parts.at(-1);
  if (nickname && t.includes(nickname)) return true;

  const target = sport ? resolveKnownTeam(team, sport) : null;
  if (!target) return false;
  return t
    .split(" ")
    .some(
      (token) =>
        token.length >= 2 &&
        resolveKnownTeam(token, sport!)?.key === target.key,
    );
}

/**
 * A signed handicap left in the selection that nothing has consumed.
 *
 * "HOU -1 (-124)" is a run line, but its trailing price stops the spread parser
 * anchoring on the number, so it used to reach the moneyline branch and settle
 * as if the handicap were not there — a different bet, and a different result
 * whenever the game lands on exactly that margin. Prices are excluded: three or
 * more digits is American odds, not a handicap.
 */
function hasUnreadHandicap(selection: string): boolean {
  return /(?:^|\s)[+-]\d{1,2}(?:\.\d)?(?=\s|$|\))/.test(selection.trim());
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

/** Parse the board's explicit "Away @ Home" fixture label. */
function parseEventLabel(text: string): { a: string; b: string } | null {
  const at = text.match(/^\s*(.+?)\s+@\s+(.+?)\s*$/);
  if (at?.[1] && at[2]) {
    return { a: at[1].trim(), b: at[2].trim() };
  }
  return parseMatchupSides(text);
}

function teamsAreOpponents(a: string, b: string, game: SettledGame): boolean {
  const aHome = mentions(a, game.home, game.sport);
  const aAway = mentions(a, game.away, game.sport);
  const bHome = mentions(b, game.home, game.sport);
  const bAway = mentions(b, game.away, game.sport);
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

  // Prefer the provider event id whenever that provider is available.
  //
  // This used to fall through to generic name matching when the event was
  // absent from the settled set — which is exactly the case while a game is
  // still being played. The settled pool spans two weeks of history, so
  // "Houston Astros" matched a different final game and graded a live pick.
  // Never use generic matching here; the only fallback below requires the full
  // stored fixture and timestamp to identify a cross-provider copy.
  if (play.eventId) {
    const exact = bySport.find((g) => g.eventId === play.eventId);
    if (exact) return exact;

    // Provider ids are not portable: The Odds API stores a hexadecimal id on
    // the play while ESPN returns the same fixture under a numeric id. When the
    // paid provider is unavailable, require all of the independent fixture
    // evidence the board stored (start time + both clubs) before accepting the
    // free scoreboard copy. This preserves the live-game protection above: an
    // unfinished fixture is absent from the settled pool, an older same-team
    // game falls outside the four-hour window, and a doubleheader is ambiguous.
    const fixture =
      play.homeTeam && play.awayTeam
        ? { a: play.homeTeam, b: play.awayTeam }
        : play.eventLabel
          ? parseEventLabel(play.eventLabel)
          : null;
    if (!play.eventStartsAt || !fixture) return null;
    const crossProvider = sameFixtureWindow(play, bySport).filter(
      (game) =>
        game.startsAt != null && teamsAreOpponents(fixture.a, fixture.b, game),
    );
    return sole(crossProvider);
  }

  // Plays with no eventId — every imported legacy pick — still reach the name
  // matching below, where the same stale-pool hazard applies: a pick logged
  // today matched the first same-team game in a fortnight of history and
  // settled against a result from days earlier. Confirmed in production, where
  // 28 picks graded within 1.5-2h of first pitch, i.e. mid-game. Scoping to the
  // play's own date means an unfinished game simply finds no match and waits
  // for the next cron run, which is the intended behaviour.
  const sportGames = sameFixtureWindow(play, bySport);

  // A play that records its own fixture needs no name guessing. Imported legacy
  // rows carry Home/Away from the source platform, which is the only thing that
  // can bind a bare "Over 7 total" — nothing in that selection names a game.
  if (play.homeTeam && play.awayTeam) {
    const bound = sportGames.filter((g) =>
      teamsAreOpponents(play.homeTeam!, play.awayTeam!, g),
    );
    if (bound.length) return sole(bound);
  }

  const matchup = parseMatchupSides(play.selection);
  if (matchup) {
    const both = sportGames.filter((g) =>
      teamsAreOpponents(matchup.a, matchup.b, g),
    );
    if (both.length) return sole(both);
  }

  const bySelection = sportGames.filter((g) => {
    const pickedHome =
      mentions(play.selection, g.home, g.sport) ||
      mentions(play.side ?? "", g.home, g.sport);
    const pickedAway =
      mentions(play.selection, g.away, g.sport) ||
      mentions(play.side ?? "", g.away, g.sport);
    return pickedHome !== pickedAway;
  });
  if (bySelection.length) return sole(bySelection);

  const byMarket = sportGames.filter(
    (g) =>
      mentions(play.market, g.home, g.sport) ||
      mentions(play.market, g.away, g.sport),
  );
  if (byMarket.length) return sole(byMarket);

  return null;
}

/**
 * Largest plausible handicap, used to tell a line from a price.
 *
 * The legacy platform writes moneylines as "TBR -147" — team plus American
 * price — which is the same shape as team-plus-handicap. Read naively, that
 * pick graded as a SPREAD of -147: a margin no baseball game reaches, so every
 * such play settled LOSS regardless of who won. No handicap in the sports SCL
 * carries approaches this, while any three-digit American price exceeds it.
 */
const MAX_PLAUSIBLE_HANDICAP = 60;

/**
 * Which club a play backs, as home/away against a settled game.
 * `null` = an explicit Draw selection; `undefined` = can't tell (→ defer).
 */
export function pickedSideForGame(
  play: Pick<GradablePlay, "selection" | "side">,
  game: SettledGame,
): boolean | null | undefined {
  const text = `${play.selection} ${play.side ?? ""}`;
  if (/(draw|tie)/i.test(text)) return null;
  const home =
    mentions(play.selection, game.home, game.sport) ||
    mentions(play.side ?? "", game.home, game.sport);
  const away =
    mentions(play.selection, game.away, game.sport) ||
    mentions(play.side ?? "", game.away, game.sport);
  if (home === away) return undefined;
  return home;
}

export function parseSpreadFromSelection(
  selection: string,
): { team: string; line: number } | null {
  const match = selection.match(/^(.+?)\s*([+-]\d+(?:\.\d+)?)\s*$/);
  if (!match) return null;
  const team = match[1]!.trim();
  const line = Number(match[2]);
  if (!team || Number.isNaN(line)) return null;
  if (Math.abs(line) > MAX_PLAUSIBLE_HANDICAP) return null;
  return { team, line };
}

function gradeSpread(
  game: SettledGame,
  pickedTeam: string,
  line: number,
): "WIN" | "LOSS" | "PUSH" | null {
  const pickedHome = mentions(pickedTeam, game.home, game.sport);
  const pickedAway = mentions(pickedTeam, game.away, game.sport);
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

  // ---- team totals (one club's runs) ----
  //
  // MUST precede the game-total branch below, which triggers on
  // `market.includes("total")` — and "Team Total" contains "total". Reaching it
  // would settle "Nationals Over 4.5" against BOTH clubs' runs: a 3-2 game is 5
  // combined, a WIN on a bet the capper never made. Resolving here, against the
  // named club's own score, is the whole point of the market being separate.
  if (isTeamTotalMarket(play.market)) {
    const parsed = parseTeamTotalSelection(play.selection);
    // Only the canonical board-written form resolves. A free-text legacy pick
    // ("Nats TT O4.5") returns null and stays PENDING rather than being graded
    // on a guess about which club it names.
    if (!parsed) return null;
    const pickedHome = mentions(parsed.team, game.home, game.sport);
    const pickedAway = mentions(parsed.team, game.away, game.sport);
    if (pickedHome === pickedAway) return null;
    const teamScore = pickedHome ? game.homeScore : game.awayScore;
    if (teamScore === parsed.line) return "PUSH";
    const wentOver = teamScore > parsed.line;
    return (parsed.side === "Over") === wentOver ? "WIN" : "LOSS";
  }

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
  //
  // Only when nothing in the selection says otherwise. A handicap the parser
  // above could not read — "HOU -1 (-124)", where the trailing price stops it
  // anchoring on the number — is a run line, and settling it as a moneyline
  // silently grades a bet the capper did not make. Defer instead.
  if (hasUnreadHandicap(play.selection)) return null;

  const pickedHome =
    mentions(play.selection, game.home, game.sport) ||
    mentions(play.side ?? "", game.home, game.sport);
  const pickedAway =
    mentions(play.selection, game.away, game.sport) ||
    mentions(play.side ?? "", game.away, game.sport);
  if (pickedHome === pickedAway) return null;
  if (game.homeScore === game.awayScore) return "PUSH";
  const homeWon = game.homeScore > game.awayScore;
  return pickedHome === homeWon ? "WIN" : "LOSS";
}
