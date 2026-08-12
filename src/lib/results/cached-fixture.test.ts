import assert from "node:assert/strict";
import test from "node:test";

import { recoverFixtureFromSelections } from "@/lib/results/cached-fixture";

const play = {
  id: "play",
  sport: "MLB",
  market: "Total",
  selection: "Under 9",
  oddsAmerican: -110,
  units: 1,
  eventId: "odds-hash",
  eventStartsAt: new Date("2026-08-11T22:41:00Z"),
};

test("retained moneylines recover a unique official fixture for a generic total", () => {
  const fixture = recoverFixtureFromSelections(
    play,
    [
      {
        label: "Pirates ML",
        market: "Moneyline",
        selection: "Pittsburgh Pirates",
        side: "Pittsburgh Pirates",
        oddsAmerican: 120,
      },
      {
        label: "Marlins ML",
        market: "Moneyline",
        selection: "Miami Marlins",
        side: "Miami Marlins",
        oddsAmerican: -130,
      },
    ],
    [
      {
        sport: "MLB",
        home: "Miami Marlins",
        away: "Pittsburgh Pirates",
        homeScore: 2,
        awayScore: 0,
        completed: true,
        eventId: "mlb:823832",
        startsAt: new Date("2026-08-11T22:40:00Z"),
      },
      {
        sport: "MLB",
        home: "Detroit Tigers",
        away: "Cleveland Guardians",
        homeScore: 6,
        awayScore: 4,
        completed: true,
        eventId: "mlb:824240",
        startsAt: new Date("2026-08-11T22:40:00Z"),
      },
    ],
  );
  assert.deepEqual(fixture, {
    homeTeam: "Miami Marlins",
    awayTeam: "Pittsburgh Pirates",
    eventLabel: "Pittsburgh Pirates @ Miami Marlins",
  });
});

test("cache recovery refuses incomplete or ambiguous moneyline identity", () => {
  assert.equal(
    recoverFixtureFromSelections(
      play,
      [
        {
          label: "Over",
          market: "Total",
          selection: "Over 9",
          side: "Over",
          oddsAmerican: -110,
        },
      ],
      [],
    ),
    null,
  );
});
