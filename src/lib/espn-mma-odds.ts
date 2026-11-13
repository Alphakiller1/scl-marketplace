import {
  MMA_METHOD_LABELS,
  MMA_WINNING_METHOD,
  sameMmaBout,
  type MmaWinningMethod,
} from "@/lib/mma-winning-method";
import type { OddsEvent, OddsSelection } from "@/lib/odds-board";
import { yyyymmddUtc } from "@/lib/results/espn-scoreboard-map";
import { surfaceCommenceBounds } from "@/lib/odds-surface-window";

const UFC_SCOREBOARD =
  "https://site.web.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const UFC_EVENTS =
  "https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events";

export function espnMmaBoutUrl(
  cardId: string,
  boutId: string,
  endpoint: "odds/100" | "status",
): string {
  return `${UFC_EVENTS}/${cardId}/competitions/${boutId}/${endpoint}?lang=en&region=us`;
}

type EspnMmaCard = {
  id?: string;
  date?: string;
  competitions?: {
    id?: string;
    date?: string;
    status?: { type?: { state?: string } };
    competitors?: { id?: string; athlete?: { displayName?: string } }[];
  }[];
};

type FighterOdds = {
  athlete?: { $ref?: string };
  current?: {
    victoryMethod?: Partial<Record<MmaWinningMethod, { american?: string }>>;
  };
};

export type EspnMmaOdds = {
  provider?: { id?: string };
  homeAthleteOdds?: FighterOdds;
  awayAthleteOdds?: FighterOdds;
};

/** Match by ESPN athlete ID because its odds corners can reverse scoreboard order. */
export function espnMmaWinningMethodRows(
  odds: EspnMmaOdds,
  fighters: ReadonlyMap<string, string>,
): OddsSelection[] {
  if (odds.provider?.id !== "100") return [];
  const rows: OddsSelection[] = [];
  for (const corner of [odds.homeAthleteOdds, odds.awayAthleteOdds]) {
    const athleteId = corner?.athlete?.$ref?.match(
      /\/athletes\/(\d+)(?:\?|$)/,
    )?.[1];
    const fighter = athleteId ? fighters.get(athleteId) : undefined;
    if (!fighter) continue;
    for (const [method, label] of Object.entries(MMA_METHOD_LABELS)) {
      const price = Number(
        corner?.current?.victoryMethod?.[method as MmaWinningMethod]?.american,
      );
      if (!Number.isSafeInteger(price) || Math.abs(price) < 100) continue;
      const selection = `${fighter} by ${label}`;
      rows.push({
        market: MMA_WINNING_METHOD,
        label: selection,
        selection,
        side: selection,
        featured: true,
        oddsAmerican: price,
        book: "draftkings",
        bookPrices: { draftkings: price },
      });
    }
  }
  return rows;
}

/** Attach DraftKings' fighter-specific prices to the existing SCL fixtures. */
export async function addEspnMmaWinningMethods(
  board: OddsEvent[],
  now = new Date(),
): Promise<OddsEvent[]> {
  if (board.length === 0) return board;
  const { to } = surfaceCommenceBounds(now);
  const dates = `${yyyymmddUtc(now)}-${yyyymmddUtc(new Date(to))}`;
  let cards: EspnMmaCard[];
  try {
    const response = await fetch(`${UFC_SCOREBOARD}?dates=${dates}`, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return board;
    const payload = (await response.json()) as { events?: EspnMmaCard[] };
    cards = payload.events ?? [];
  } catch {
    return board;
  }

  const bouts = cards.flatMap((card) =>
    (card.competitions ?? []).flatMap((bout) => {
      const [first, second] = bout.competitors ?? [];
      const home = first?.athlete?.displayName;
      const away = second?.athlete?.displayName;
      const startsAt = Date.parse(bout.date ?? card.date ?? "");
      if (
        !card.id ||
        !bout.id ||
        !first?.id ||
        !second?.id ||
        !home ||
        !away ||
        bout.competitors?.length !== 2 ||
        bout.status?.type?.state !== "pre" ||
        !(startsAt > now.getTime())
      ) {
        return [];
      }
      return [
        {
          cardId: card.id,
          boutId: bout.id,
          home,
          away,
          startsAt,
          firstId: first.id,
          secondId: second.id,
        },
      ];
    }),
  );

  const enriched: OddsEvent[] = [];
  for (let index = 0; index < board.length; index += 6) {
    const batch = await Promise.all(
      board.slice(index, index + 6).map(async (event) => {
        const startsAt = Date.parse(event.commenceTime);
        if (!(startsAt > now.getTime())) return event;
        const matches = bouts.filter((bout) =>
          sameMmaBout({ ...event, startsAt }, bout),
        );
        if (matches.length !== 1) return event;
        const bout = matches[0]!;
        try {
          const response = await fetch(
            espnMmaBoutUrl(bout.cardId, bout.boutId, "odds/100"),
            {
              next: { revalidate: 600 },
              signal: AbortSignal.timeout(4_000),
            },
          );
          if (!response.ok) return event;
          const odds = (await response.json()) as EspnMmaOdds;
          const rows = espnMmaWinningMethodRows(
            odds,
            new Map([
              [bout.firstId, bout.home],
              [bout.secondId, bout.away],
            ]),
          );
          return rows.length
            ? { ...event, selections: [...event.selections, ...rows] }
            : event;
        } catch {
          return event;
        }
      }),
    );
    enriched.push(...batch);
  }
  return enriched;
}
