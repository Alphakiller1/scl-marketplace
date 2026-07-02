import type { SettledGame } from "@/lib/results/provider";

/**
 * Pure play↔result matching (no DB, no server-only) so it's unit-testable.
 * Resolves a play to an outcome from settled games, or `null` when it can't be
 * graded confidently (left PENDING for manual review). Handles the reliable
 * cases — moneyline (pick a team) and game totals (over/under a number).
 */
export type GradablePlay = {
  id: string;
  sport: string;
  market: string;
  selection: string;
  oddsAmerican: number;
  units: number;
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
  const nickname = parts.at(-1); // distinctive last word, e.g. "Celtics"
  return (!!nickname && t.includes(nickname)) || t.includes(norm(team));
}

export function resolveOutcome(
  play: GradablePlay,
  games: SettledGame[],
): "WIN" | "LOSS" | "PUSH" | null {
  const sportGames = games.filter((g) => g.sport === play.sport);
  const market = norm(play.market);
  const selection = norm(play.selection);

  // ---- totals (over/under a number) ----
  // Parse the line from the RAW selection — norm() strips the decimal point.
  const totalMatch = play.selection
    .toLowerCase()
    .match(/(over|under)\D*(\d+(?:\.\d+)?)/);
  const isTotal =
    market.includes("total") || /\b(o|u|over|under)\b/.test(selection);
  if (totalMatch && isTotal) {
    const side = totalMatch[1];
    const line = Number(totalMatch[2]);
    const game = sportGames.find(
      (g) => mentions(play.market, g.home) || mentions(play.market, g.away),
    );
    if (!game) return null;
    const total = game.homeScore + game.awayScore;
    if (total === line) return "PUSH";
    const over = total > line;
    return (side === "over") === over ? "WIN" : "LOSS";
  }

  // ---- moneyline (a team wins) ----
  for (const g of sportGames) {
    const pickedHome = mentions(play.selection, g.home);
    const pickedAway = mentions(play.selection, g.away);
    if (pickedHome === pickedAway) continue; // no single clear team
    if (g.homeScore === g.awayScore) return "PUSH";
    const homeWon = g.homeScore > g.awayScore;
    return pickedHome === homeWon ? "WIN" : "LOSS";
  }

  return null;
}
