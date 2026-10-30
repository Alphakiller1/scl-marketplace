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
  /** Tournament name, on the top-level event ("Erste Bank Open"). */
  name?: string;
  grouping?: { slug?: string };
  competitions?: (NonNullable<
    NonNullable<EspnScoreboardPayload["events"]>[number]["competitions"]
  >[number] & {
    type?: { slug?: string };
    round?: { displayName?: string };
  })[];
  groupings?: TennisNode[];
};

function collectCompetitions(
  node: TennisNode,
): NonNullable<TennisNode["competitions"]> {
  return [
    ...(node.competitions ?? []).map((competition) => ({
      ...competition,
      type: competition.type ?? node.grouping,
    })),
    ...(node.groupings ?? []).flatMap((child) => collectCompetitions(child)),
  ];
}

const GRAND_SLAM =
  /\b(australian open|roland[\s-]garros|french open|wimbledon|us open)\b/i;

function isGrandSlam(tournamentName: string): boolean {
  return GRAND_SLAM.test(tournamentName);
}

export function flattenEspnTennisScoreboard(
  payload: {
    events?: TennisNode[];
  },
  tour?: "atp" | "wta",
): EspnScoreboardPayload {
  const events: NonNullable<EspnScoreboardPayload["events"]> = [];
  for (const tournament of payload.events ?? []) {
    for (const competition of collectCompetitions(tournament)) {
      // A retired/walkover winner flag is not a book-specific settlement.
      const status = competition.status?.type?.name;
      if (status && status !== "STATUS_FINAL") continue;
      const draw = competition.type?.slug;
      // Combined cards include both tours, but stamp the requested tour's
      // format onto EVERY match (US Open: ATP=5, WTA=3). Read each singles
      // draw from its own tour; merging duplicate cards cannot repair format.
      if (
        tour &&
        draw &&
        draw !== (tour === "atp" ? "mens-singles" : "womens-singles")
      )
        continue;
      // Men play best-of-five only in a Grand Slam main draw. ESPN's ATP card
      // stamps 5 on every tour event, so Vienna and Basel 2-0 wins read as
      // unfinished and every games spread/total stayed PENDING. A card with no
      // tournament name keeps the feed's value: deferring beats guessing.
      const bestOfThree =
        draw === "womens-singles" ||
        (draw === "mens-singles" &&
          (/^Qualifying\b/i.test(competition.round?.displayName ?? "") ||
            (tournament.name != null && !isGrandSlam(tournament.name))));
      const normalized = bestOfThree
        ? { ...competition, format: { regulation: { periods: 3 } } }
        : competition;
      events.push({
        id: competition.id,
        date: competition.date,
        competitions: [normalized],
        status: competition.status,
      });
    }
  }
  return { events };
}

export function mapEspnTennisScoreboard(
  payload: {
    events?: TennisNode[];
  },
  tour?: "atp" | "wta",
): SettledGame[] {
  return mapEspnScoreboard(
    "TENNIS",
    flattenEspnTennisScoreboard(payload, tour),
  );
}
