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
};

/** Player props / partial-game markets defer until a dedicated stats provider exists. */
export function isDeferredProp(play: GradablePlay): boolean {
  const market = norm(play.market);
  const selection = norm(play.selection);
  if (market.includes("prop") || market.includes("player")) return true;
  if (market.includes("inning") || selection.includes("first five"))
    return true;
  if (/\bf5\b/.test(selection) || selection.includes("innings")) return true;
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

export function findGame(
  play: GradablePlay,
  games: SettledGame[],
): SettledGame | null {
  const sportGames = games.filter((g) => g.sport === play.sport);

  if (play.eventId) {
    const byId = sportGames.find((g) => g.eventId === play.eventId);
    if (byId) return byId;
  }

  const matchup = parseMatchupSides(play.selection);
  if (matchup) {
    const both = sportGames.find((g) =>
      teamsAreOpponents(matchup.a, matchup.b, g),
    );
    if (both) return both;
  }

  for (const g of sportGames) {
    const pickedHome =
      mentions(play.selection, g.home) || mentions(play.side ?? "", g.home);
    const pickedAway =
      mentions(play.selection, g.away) || mentions(play.side ?? "", g.away);
    if (pickedHome !== pickedAway) return g;
  }

  for (const g of sportGames) {
    if (mentions(play.market, g.home) || mentions(play.market, g.away)) {
      return g;
    }
  }

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
