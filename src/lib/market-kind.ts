import { isPeriodMarket, PERIOD_MARKET_LABEL } from "@/lib/period-markets";
import { isTeamTotalMarket, TEAM_TOTAL_LABEL } from "@/lib/team-total-markets";

/**
 * Is this market a game line, or a player prop?
 *
 * One question, asked in one place, because getting it wrong is silent and has
 * now cost two markets. The board splits an expanded event with this test and
 * sends everything else to the player-prop bucket — which groups by `s.player`
 * and does `if (!player) continue`. A game line has no player, so a market this
 * function fails to recognise is filed under the wrong heading AND discarded:
 * it renders nothing at all, which reads as "the feed has no lines" rather than
 * as a bug.
 *
 * F3/F5/F7 shipped that way and were invisible until someone asked. Team totals
 * would have been the second. The classifier is therefore derived from the
 * market registries rather than restating them — a new period segment or a new
 * team-total key is recognised the moment it is registered, and
 * `market-kind.test.ts` walks every registered label to prove it.
 *
 * Pure — no network, no server-only, unit-testable (the old copy lived
 * un-exported inside a `.tsx`, which is why it was never covered).
 */

/** Full-game markets, in the order a sportsbook lists them. */
export const CORE_GAME_MARKETS = ["Moneyline", "Spread", "Total"] as const;

/**
 * The straight "who won" market. Exact label match, like the team-total test:
 * "1st 5 Innings Moneyline" is a different bet and must not pass as this one.
 */
export function isMoneylineMarket(market: string): boolean {
  return market.trim().toLowerCase() === "moneyline";
}

export function isGameLineMarket(market: string): boolean {
  const m = market.trim();
  return (
    (CORE_GAME_MARKETS as readonly string[]).includes(m) ||
    isPeriodMarket(m) ||
    isTeamTotalMarket(m)
  );
}

/**
 * Every market label that must classify as a game line, built from the
 * registries themselves. The test walks this, so registering a market without
 * teaching the classifier about it fails rather than silently rendering nothing.
 */
export function allGameLineLabels(): string[] {
  return [
    ...CORE_GAME_MARKETS,
    ...new Set(Object.values(PERIOD_MARKET_LABEL)),
    TEAM_TOTAL_LABEL,
  ];
}
