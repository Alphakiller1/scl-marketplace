import assert from "node:assert/strict";
import test from "node:test";
import { mapEspnTennisScoreboard } from "@/lib/results/espn-tennis-map";
import { resolveOutcome } from "@/lib/results/match";

function walkover() {
  return {
    events: [
      {
        name: "Rolex Paris Masters",
        groupings: [
          {
            competitions: [
              {
                id: "186502",
                date: "2026-11-05T18:00Z",
                type: { slug: "mens-singles" },
                status: { type: { completed: true, name: "STATUS_WALKOVER" } },
                competitors: [
                  {
                    homeAway: "away",
                    winner: true,
                    athlete: { displayName: "Carlos Alcaraz" },
                  },
                  {
                    homeAway: "home",
                    winner: false,
                    athlete: { displayName: "Matteo Berrettini" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

test("Paris walkover voids moneylines, game spreads, totals and parlay legs without inventing a win", () => {
  const games = mapEspnTennisScoreboard(walkover(), "atp");
  assert.equal(games.length, 1);
  assert.equal(games[0].voided, true);
  for (const [market, selection] of [
    ["Moneyline", "Carlos Alcaraz"],
    ["Spread", "Matteo Berrettini +4.5"],
    ["Total", "Over 21.5"],
  ]) {
    for (const units of [10, 0])
      assert.equal(
        resolveOutcome(
          {
            id: "pending",
            sport: "TENNIS",
            market,
            selection,
            units,
            oddsAmerican: -110,
            eventId: "odds:fixture",
            eventLabel: "Carlos Alcaraz @ Matteo Berrettini",
            eventStartsAt: new Date("2026-11-05T18:10Z"),
          },
          games,
        ),
        "VOID",
      );
  }
});

test("retirements, unconfirmed walkovers and walkovers with contradictory playing scores defer", () => {
  for (const status of ["STATUS_RETIRED", "STATUS_SCHEDULED"]) {
    const payload = walkover();
    payload.events[0].groupings[0].competitions[0].status.type.name = status;
    assert.equal(mapEspnTennisScoreboard(payload, "atp").length, 0);
  }
  const unconfirmed = walkover();
  unconfirmed.events[0].groupings[0].competitions[0].status.type.completed = false;
  assert.equal(mapEspnTennisScoreboard(unconfirmed, "atp").length, 0);
  const played = walkover();
  Object.assign(played.events[0].groupings[0].competitions[0].competitors[0], {
    linescores: [{ value: 6 }],
  });
  assert.equal(mapEspnTennisScoreboard(played, "atp").length, 0);
});
