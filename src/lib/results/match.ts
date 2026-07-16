import type { SettledGame } from "@/lib/results/provider";

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

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function mentions(text: string, team: string): boolean {
  const t = norm(text);
  const parts = norm(team)
    .split(" ")
    .filter((p) => p.length > 2);
  const nickname = parts.at(-1);
  return (!!nickname && t.includes(nickname)) || t.includes(norm(team));
}

function findGame(
  play: GradablePlay,
  games: SettledGame[],
): SettledGame | null {
  const sportGames = games.filter((g) => g.sport === play.sport);

  if (play.eventId) {
    const byId = sportGames.find((g) => g.eventId === play.eventId);
    if (byId) return byId;
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
  const market = norm(play.market);
  const selection = norm(play.selection);
  const game = findGame(play, games);
  if (!game) return null;

  // ---- totals (over/under a number) ----
  const totalMatch = play.selection
    .toLowerCase()
    .match(/(over|under)\D*(\d+(?:\.\d+)?)/);
  const isTotal =
    market.includes("total") || /\b(o|u|over|under)\b/.test(selection);
  if (totalMatch && isTotal) {
    const side = totalMatch[1];
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
