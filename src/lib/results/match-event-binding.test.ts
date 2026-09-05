import assert from "node:assert/strict";
import { test } from "node:test";

import { marketKeysForMarket, verificationMarkets } from "@/lib/odds-verify";
import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";
import type { SettledGame } from "@/lib/results/settled-game";

/**
 * A live pick must never be graded from an older game.
 *
 * The settled pool spans two weeks of scoreboard history, so a team plays many
 * times inside it. When an event-bound play fell through to team-name matching,
 * today's Houston Astros pick matched *last week's* Astros game and settled as a
 * WIN while the real game was 0-0 in the third inning.
 */
const YESTERDAYS_ASTROS_GAME: SettledGame = {
  sport: "MLB",
  home: "Houston Astros",
  away: "Seattle Mariners",
  homeScore: 7,
  awayScore: 2,
  completed: true,
  eventId: "evt-mlb-yesterday",
};

const play = (over: Partial<GradablePlay> = {}): GradablePlay => ({
  id: "play-1",
  sport: "MLB",
  market: "Moneyline",
  selection: "Houston Astros",
  oddsAmerican: -140,
  units: 1,
  eventId: "evt-mlb-today",
  ...over,
});

test("an event-bound play is not graded from a different game", () => {
  // Today's game is still in progress, so it is absent from the settled pool.
  // The only Astros game present is an earlier, finished one.
  assert.equal(findGame(play(), [YESTERDAYS_ASTROS_GAME]), null);
});

test("an event-bound play still grades against its own event", () => {
  const todaysGame: SettledGame = {
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: "evt-mlb-today",
  };
  const found = findGame(play(), [YESTERDAYS_ASTROS_GAME, todaysGame]);
  assert.equal(found?.eventId, "evt-mlb-today");
});

test("an event-bound play matches the same fixture from a backstop provider", () => {
  const start = new Date("2026-08-10T23:10:00.000Z");
  const espnGame: SettledGame = {
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: "espn:401999001",
    espnEventId: "401999001",
    startsAt: new Date("2026-08-10T23:12:00.000Z"),
  };
  const found = findGame(
    play({
      eventId: "0f2a3b4c5d6e7f8091a2b3c4d5e6f708",
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: start,
    }),
    [espnGame],
  );
  assert.equal(found?.eventId, "espn:401999001");
});

test("a legacy bound play missing its fixture label recovers from team and start slot", () => {
  const found = findGame(
    play({
      selection: "Tampa Bay Rays (F5 ML)",
      eventId: "79a0c1e324175df9d0c7f93de8d4dc44",
      eventLabel: null,
      eventStartsAt: new Date("2026-08-09T01:50:00.000Z"),
    }),
    [
      {
        sport: "MLB",
        home: "Seattle Mariners",
        away: "Tampa Bay Rays",
        homeScore: 2,
        awayScore: 4,
        completed: true,
        eventId: "espn:401999004",
        startsAt: new Date("2026-08-09T01:52:00.000Z"),
      },
    ],
  );
  assert.equal(found?.eventId, "espn:401999004");
});

test("cross-provider matching still rejects an older same-team result", () => {
  const found = findGame(
    play({
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: new Date("2026-08-10T23:10:00.000Z"),
    }),
    [
      {
        ...YESTERDAYS_ASTROS_GAME,
        away: "Texas Rangers",
        startsAt: new Date("2026-08-09T23:10:00.000Z"),
        eventId: "espn:401999000",
      },
    ],
  );
  assert.equal(found, null);
});

test("cross-provider matching refuses an ambiguous doubleheader", () => {
  const start = new Date("2026-08-10T20:00:00.000Z");
  const fixture = (id: string, startsAt: string): SettledGame => ({
    sport: "MLB",
    home: "Houston Astros",
    away: "Texas Rangers",
    homeScore: 5,
    awayScore: 1,
    completed: true,
    eventId: `espn:${id}`,
    startsAt: new Date(startsAt),
  });
  const found = findGame(
    play({
      eventLabel: "Texas Rangers @ Houston Astros",
      eventStartsAt: start,
    }),
    [
      fixture("401999002", "2026-08-10T19:30:00.000Z"),
      fixture("401999003", "2026-08-10T20:30:00.000Z"),
    ],
  );
  assert.equal(found, null);
});

test("an event-bound soccer play follows an exact fixture postponed by one day", () => {
  const found = findGame(
    play({
      sport: "SOCCER",
      selection: "Aalesund",
      eventId: "old-provider-id",
      eventLabel: "Aalesund @ Viking",
      homeTeam: "Viking",
      awayTeam: "Aalesund",
      eventStartsAt: new Date("2026-08-29T16:00:00.000Z"),
    }),
    [
      {
        sport: "SOCCER",
        home: "Viking",
        away: "Aalesund",
        homeScore: 2,
        awayScore: 1,
        completed: true,
        eventId: "new-provider-id",
        startsAt: new Date("2026-08-30T15:00:00.000Z"),
      },
    ],
  );
  assert.equal(found?.eventId, "new-provider-id");
});

test("the soccer reschedule window requires both stored clubs", () => {
  const found = findGame(
    play({
      sport: "SOCCER",
      selection: "Molde",
      eventId: "old-provider-id",
      eventLabel: null,
      homeTeam: null,
      awayTeam: null,
      eventStartsAt: new Date("2026-08-29T14:00:00.000Z"),
    }),
    [
      {
        sport: "SOCCER",
        home: "Valerenga",
        away: "Molde",
        homeScore: 3,
        awayScore: 4,
        completed: true,
        eventId: "new-provider-id",
        startsAt: new Date("2026-08-30T15:00:00.000Z"),
      },
    ],
  );
  assert.equal(found, null);
});

test("generic Town suffix does not make both soccer clubs match the pick", () => {
  const outcome = resolveOutcome(
    play({
      sport: "SOCCER",
      market: "Moneyline",
      selection: "Grimsby Town",
      side: "Grimsby Town",
      eventId: "grimsby-fleetwood",
    }),
    [
      {
        sport: "SOCCER",
        home: "Grimsby Town",
        away: "Fleetwood Town",
        homeScore: 2,
        awayScore: 2,
        completed: true,
        eventId: "grimsby-fleetwood",
      },
    ],
  );
  assert.equal(outcome, "LOSS");
});

test("a finished doubleheader opener cannot settle a bound nightcap", () => {
  const found = findGame(
    play({
      eventLabel: null,
      eventStartsAt: new Date("2026-08-10T22:00:00.000Z"),
    }),
    [
      {
        sport: "MLB",
        home: "Houston Astros",
        away: "Texas Rangers",
        homeScore: 5,
        awayScore: 1,
        completed: true,
        eventId: "espn:401999002",
        startsAt: new Date("2026-08-10T19:00:00.000Z"),
      },
    ],
  );
  assert.equal(found, null);
});

test("a play with no event id may still match on team names", () => {
  // Legacy and free-text picks carry no binding; name matching is all there is,
  // and removing it would leave them permanently ungradable.
  const found = findGame(play({ eventId: null }), [YESTERDAYS_ASTROS_GAME]);
  assert.equal(found?.eventId, "evt-mlb-yesterday");
});

test("event binding is not defeated by a same-name game in another sport", () => {
  const found = findGame(play({ sport: "NBA" }), [YESTERDAYS_ASTROS_GAME]);
  assert.equal(found, null);
});

// ── alternate prop markets ───────────────────────────────────────────────────

/**
 * Milestone "X+" lines (6+ strikeouts) exist ONLY under the `_alternate` market
 * key. Requesting the featured key alone is why lines visible at the book never
 * reached the board.
 */
test("curated props request their alternate market too", () => {
  const mlb = verificationMarkets("MLB");
  assert.ok(mlb.includes("pitcher_strikeouts"));
  assert.ok(mlb.includes("pitcher_strikeouts_alternate"));
  assert.ok(mlb.includes("batter_hits_alternate"));
});

test("game lines keep their existing alternate bundling", () => {
  const mlb = verificationMarkets("MLB");
  assert.ok(mlb.includes("alternate_spreads"));
  assert.ok(mlb.includes("alternate_totals"));
});

test("a prop label verifies against featured and alternate", () => {
  assert.deepEqual(marketKeysForMarket("Strikeouts"), [
    "pitcher_strikeouts",
    "pitcher_strikeouts_alternate",
  ]);
});

test("every requested market is unique — duplicates would waste credits", () => {
  for (const sport of ["MLB", "NBA", "NFL", "WNBA", "NHL"]) {
    const markets = verificationMarkets(sport);
    assert.equal(
      markets.length,
      new Set(markets).size,
      `${sport} requests a duplicate market`,
    );
  }
});

test("a bound UFC fight matches ESPN hours after the card start", () => {
  const found = findGame(
    {
      id: "mma-1",
      sport: "MMA",
      market: "Moneyline",
      selection: "Islam Makhachev",
      oddsAmerican: -180,
      units: 1,
      eventId: "4f7dfc2ff8abe952d4431bbbda20ef31",
      eventLabel: "Ian Machado Garry @ Islam Makhachev",
      homeTeam: "Islam Makhachev",
      awayTeam: "Ian Machado Garry",
      eventStartsAt: new Date("2026-08-16T02:05:00.000Z"),
    },
    [
      {
        sport: "MMA",
        home: "Islam Makhachev",
        away: "Ian Machado Garry",
        homeScore: 1,
        awayScore: 0,
        completed: true,
        eventId: "espn:401905000",
        startsAt: new Date("2026-08-15T21:30:00.000Z"),
      },
    ],
  );
  assert.equal(found?.eventId, "espn:401905000");
});

/**
 * Order of play at a slam moves matches by days.
 *
 * These three are the real US Open plays that sat ungraded on 2026-09-05: the
 * board's scheduled commence against the start ESPN actually stamped. Every one
 * existed on ESPN, completed, the whole time — the 4h fixture window filtered
 * it out, so they read `event_not_found` until they aged out permanently.
 */
const US_OPEN_DRIFT = [
  {
    label: "Zverev, out by 34h",
    a: "Lorenzo Sonego",
    b: "Alexander Zverev",
    booked: "2026-08-31T15:00:00.000Z",
    played: "2026-09-02T01:00:00.000Z",
  },
  {
    label: "van de Zandschulp, out by 22h and cased differently",
    a: "Botic van de Zandschulp",
    b: "Jan Choinski",
    espnA: "Botic Van De Zandschulp",
    booked: "2026-09-01T19:00:00.000Z",
    played: "2026-09-02T16:40:00.000Z",
  },
  {
    label: "de Minaur, out by 21h",
    a: "Alex de Minaur",
    b: "Andrea Guerrieri",
    booked: "2026-09-01T21:00:00.000Z",
    played: "2026-09-02T18:10:00.000Z",
  },
] as const;

for (const drift of US_OPEN_DRIFT) {
  test(`a rescheduled tennis match still grades — ${drift.label}`, () => {
    const found = findGame(
      play({
        sport: "TENNIS",
        market: "Moneyline",
        selection: drift.b,
        eventId: "odds-api-hex-id",
        eventLabel: `${drift.a} @ ${drift.b}`,
        eventStartsAt: new Date(drift.booked),
      }),
      [
        {
          sport: "TENNIS",
          home: drift.b,
          away: "espnA" in drift ? drift.espnA : drift.a,
          homeScore: 3,
          awayScore: 1,
          completed: true,
          eventId: "espn-numeric-id",
          startsAt: new Date(drift.played),
        },
      ],
    );
    assert.equal(found?.eventId, "espn-numeric-id");
  });
}

test("a tennis reschedule join still needs both players", () => {
  // Only the picked player is stored, so the wider clock is not permitted —
  // exactly the guard the soccer window carries.
  const found = findGame(
    play({
      sport: "TENNIS",
      market: "Moneyline",
      selection: "Alexander Zverev",
      eventId: "odds-api-hex-id",
      eventLabel: null,
      homeTeam: null,
      awayTeam: null,
      eventStartsAt: new Date("2026-08-31T15:00:00.000Z"),
    }),
    [
      {
        sport: "TENNIS",
        home: "Alexander Zverev",
        away: "Lorenzo Sonego",
        homeScore: 3,
        awayScore: 0,
        completed: true,
        eventId: "espn-numeric-id",
        startsAt: new Date("2026-09-02T01:00:00.000Z"),
      },
    ],
  );
  assert.equal(found, null);
});

test("a later round does not settle an earlier one", () => {
  // Zverev plays Sonego then Halys inside the window. The stored pairing is
  // what separates them; without it the wider clock would be a coin flip.
  const halys: SettledGame = {
    sport: "TENNIS",
    home: "Alexander Zverev",
    away: "Quentin Halys",
    homeScore: 3,
    awayScore: 1,
    completed: true,
    eventId: "espn-r3",
    startsAt: new Date("2026-09-04T01:40:00.000Z"),
  };
  const sonego: SettledGame = {
    sport: "TENNIS",
    home: "Alexander Zverev",
    away: "Lorenzo Sonego",
    homeScore: 3,
    awayScore: 0,
    completed: true,
    eventId: "espn-r2",
    startsAt: new Date("2026-09-02T01:00:00.000Z"),
  };
  const found = findGame(
    play({
      sport: "TENNIS",
      market: "Moneyline",
      selection: "Alexander Zverev",
      eventId: "odds-api-hex-id",
      eventLabel: "Lorenzo Sonego @ Alexander Zverev",
      eventStartsAt: new Date("2026-08-31T15:00:00.000Z"),
    }),
    [halys, sonego],
  );
  assert.equal(found?.eventId, "espn-r2");
});

test("a tennis match beyond the reschedule window is not joined", () => {
  const found = findGame(
    play({
      sport: "TENNIS",
      market: "Moneyline",
      selection: "Alexander Zverev",
      eventId: "odds-api-hex-id",
      eventLabel: "Lorenzo Sonego @ Alexander Zverev",
      eventStartsAt: new Date("2026-08-28T15:00:00.000Z"),
    }),
    [
      {
        sport: "TENNIS",
        home: "Alexander Zverev",
        away: "Lorenzo Sonego",
        homeScore: 3,
        awayScore: 0,
        completed: true,
        eventId: "espn-too-far",
        startsAt: new Date("2026-09-02T01:00:00.000Z"),
      },
    ],
  );
  assert.equal(found, null);
});
