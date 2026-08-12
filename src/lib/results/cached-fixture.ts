import type { OddsSelection } from "@/lib/odds-board";
import type { OddsEventIdentity } from "@/lib/odds-event-identity-contract";
import { findGame, type GradablePlay } from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

export type RecoveredFixture = {
  homeTeam: string;
  awayTeam: string;
  eventLabel: string;
};

/**
 * Recover a cross-provider final from an immutable board-event identity.
 * Both opponents and the scheduled-start window still have to identify one
 * final, so even simultaneous games and doubleheaders cannot grade by accident.
 */
export function recoverFixtureFromIdentity(
  play: GradablePlay,
  identity: Pick<OddsEventIdentity, "sport" | "home" | "away">,
  games: SettledGame[],
): RecoveredFixture | null {
  if (identity.sport.toUpperCase() !== play.sport.toUpperCase()) return null;
  const matched = findGame(
    {
      ...play,
      homeTeam: identity.home,
      awayTeam: identity.away,
      eventLabel: `${identity.away} @ ${identity.home}`,
    },
    games,
  );
  if (!matched) return null;
  return {
    homeTeam: matched.home,
    awayTeam: matched.away,
    eventLabel: `${matched.away} @ ${matched.home}`,
  };
}

/**
 * Recover a provider-bound fixture from its retained event board.
 *
 * Moneyline rows name both clubs even when a historical Play row lost its
 * event label. The normal cross-provider matcher still supplies every safety
 * check (sport, scheduled-start window, both opponents, unique final), so a
 * cache row can never settle a clustered/doubleheader game by clock alone.
 */
export function recoverFixtureFromSelections(
  play: GradablePlay,
  selections: readonly OddsSelection[],
  games: SettledGame[],
): RecoveredFixture | null {
  const sides = [
    ...new Set(
      selections
        .filter(
          (selection) =>
            selection.market.trim().toLowerCase() === "moneyline" &&
            !/^draw$/i.test(selection.side.trim()),
        )
        .map((selection) => selection.side.trim())
        .filter(Boolean),
    ),
  ];
  if (sides.length !== 2) return null;
  return recoverFixtureFromIdentity(
    play,
    { sport: play.sport, home: sides[0]!, away: sides[1]! },
    games,
  );
}
