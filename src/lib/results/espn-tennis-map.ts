import {
  mapEspnScoreboard,
  type EspnScoreboardPayload,
} from "@/lib/results/espn-scoreboard-map";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * ESPN tennis scoreboards are tournament cards, not match cards.
 *
 * `events[]` is Cincinnati / Winston-Salem / the US Open. Individual matches
 * live under `groupings[].competitions[]`. `mapEspnScoreboard` already knows
 * how to turn a two-athlete FINAL into a moneyline (winner flags → 1 / 0).
 * Flattening is the only missing step — without it the grader asked Odds API
 * for tennis scores, missed Arthur Fils vs Cobolli, and 503'd the cron after
 * the 7-hour window.
 */
type TennisNode = {
  competitions?: NonNullable<
    EspnScoreboardPayload["events"]
  >[number]["competitions"];
  groupings?: TennisNode[];
};

function collectCompetitions(
  node: TennisNode,
): NonNullable<TennisNode["competitions"]> {
  return [
    ...(node.competitions ?? []),
    ...(node.groupings ?? []).flatMap((child) => collectCompetitions(child)),
  ];
}

export function flattenEspnTennisScoreboard(payload: {
  events?: TennisNode[];
}): EspnScoreboardPayload {
  const events: NonNullable<EspnScoreboardPayload["events"]> = [];
  for (const tournament of payload.events ?? []) {
    for (const competition of collectCompetitions(tournament)) {
      events.push({
        id: competition.id,
        date: competition.date,
        competitions: [competition],
        status: competition.status,
      });
    }
  }
  return { events };
}

export function mapEspnTennisScoreboard(payload: {
  events?: TennisNode[];
}): SettledGame[] {
  return mapEspnScoreboard("TENNIS", flattenEspnTennisScoreboard(payload));
}
