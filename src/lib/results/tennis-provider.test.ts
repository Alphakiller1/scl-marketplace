import assert from "node:assert/strict";
import test from "node:test";
import { loadTestModule } from "@/lib/test-support/load-module";
import * as scoreboard from "@/lib/results/espn-scoreboard-map";
import * as soccer from "@/lib/results/espn-soccer-leagues";
import * as tennis from "@/lib/results/espn-tennis-map";
import * as settled from "@/lib/results/settled-game";
import type * as Provider from "@/lib/results/espn-scores";
import { resolveOutcome } from "@/lib/results/match";

function fixture(draw: string, periods: number, round = "1st Round") {
  return {
    events: [
      {
        groupings: [
          {
            grouping: { slug: draw },
            competitions: [
              {
                id: "completed",
                date: "2026-08-23T18:00Z",
                type: { slug: draw },
                round: { displayName: round },
                status: { type: { completed: true, name: "STATUS_FINAL" } },
                format: { regulation: { periods } },
                competitors: [
                  {
                    homeAway: "home",
                    winner: true,
                    athlete: { displayName: "Iga Swiatek" },
                    linescores: [{ value: 6 }, { value: 6 }],
                  },
                  {
                    homeAway: "away",
                    winner: false,
                    athlete: { displayName: "Elena Rybakina" },
                    linescores: [{ value: 3 }, { value: 4 }],
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

test("combined tournament draws use their own tour format; qualifying stays best of three", () => {
  const women = fixture("womens-singles", 5);
  assert.equal(tennis.mapEspnTennisScoreboard(women, "atp").length, 0);
  const game = tennis.mapEspnTennisScoreboard(women, "wta")[0]!;
  assert.equal(game.regulationPeriods, 3);
  const base = {
    id: "play",
    sport: "TENNIS",
    oddsAmerican: -110,
    units: 1,
    eventId: game.eventId,
  };
  assert.equal(
    resolveOutcome({ ...base, market: "Total", selection: "Over 18.5" }, [
      game,
    ]),
    "WIN",
  );
  assert.equal(
    resolveOutcome(
      { ...base, market: "Spread", selection: "Iga Swiatek -4.5" },
      [game],
    ),
    "WIN",
  );
  assert.equal(
    resolveOutcome({ ...base, market: "Moneyline", selection: "Iga Swiatek" }, [
      game,
    ]),
    "WIN",
  );
  assert.equal(
    tennis.mapEspnTennisScoreboard(fixture("mens-singles", 3), "wta").length,
    0,
  );
  const qualifying = tennis.mapEspnTennisScoreboard(
    fixture("mens-singles", 5, "Qualifying 1st Round"),
    "atp",
  )[0]!;
  assert.equal(qualifying.regulationPeriods, 3);
  const men = tennis.mapEspnTennisScoreboard(
    fixture("mens-singles", 5),
    "atp",
  )[0]!;
  assert.equal(men.regulationPeriods, 5);
  assert.equal(
    resolveOutcome({ ...base, market: "Total", selection: "Over 18.5" }, [men]),
    null,
  );
});

test("historical pending tennis fixtures survive tournament rollover and duplicate cards", async () => {
  const urls: string[] = [];
  const provider = loadTestModule<typeof Provider>(
    "src/lib/results/espn-scores.ts",
    {
      "server-only": {},
      "@/lib/results/espn-scoreboard-map": scoreboard,
      "@/lib/results/espn-soccer-leagues": soccer,
      "@/lib/results/espn-tennis-map": tennis,
      "@/lib/results/settled-game": settled,
    },
    {
      fetch: async (url: string) => {
        urls.push(url);
        return {
          ok: true,
          json: async () =>
            url.includes("dates=20260823")
              ? fixture("womens-singles", url.includes("/atp/") ? 5 : 3)
              : { events: [] },
        };
      },
    },
  );
  const games = await provider
    .espnHistoricalResultsProvider(14, new Date("2026-09-06T12:00Z"))
    .fetchSettledForSports(["TENNIS"], {
      tennisEventDates: ["20260823", "20260823", "invalid", "20270906"],
    });
  assert.equal(urls.length, 4);
  assert.equal(games.length, 1);
  assert.equal(games[0]!.regulationPeriods, 3);
  assert.equal(
    resolveOutcome(
      {
        id: "stale-leg",
        sport: "TENNIS",
        market: "Moneyline",
        selection: "Iga Swiatek",
        oddsAmerican: -110,
        units: 0,
        eventId: "espn:completed",
      },
      games,
    ),
    "WIN",
  );
  urls.length = 0;
  await provider
    .espnHistoricalResultsProvider(1)
    .fetchSettledForSports(["MLB"]);
  assert.equal(
    urls.some((url) => url.includes("/tennis/")),
    false,
  );
});

test("retirements and walkovers are not converted to normal tennis finals", () => {
  for (const name of [
    "STATUS_RETIRED",
    "STATUS_WALKOVER",
    "STATUS_SCHEDULED",
  ]) {
    const payload = fixture("womens-singles", 5);
    payload.events[0]!.groupings[0]!.competitions[0]!.status.type.name = name;
    assert.equal(
      tennis.mapEspnTennisScoreboard(payload, "wta").length,
      0,
      name,
    );
  }
});

test("a failed current card does not prevent historical recovery", async () => {
  const provider = loadTestModule<typeof Provider>(
    "src/lib/results/espn-scores.ts",
    {
      "server-only": {},
      "@/lib/results/espn-scoreboard-map": scoreboard,
      "@/lib/results/espn-soccer-leagues": soccer,
      "@/lib/results/espn-tennis-map": tennis,
      "@/lib/results/settled-game": settled,
    },
    {
      console: { error: () => {}, warn: () => {} },
      fetch: async (url: string) => {
        if (!url.includes("?dates=")) throw new Error("timeout");
        return { ok: true, json: async () => fixture("womens-singles", 3) };
      },
    },
  );
  const games = await provider
    .espnHistoricalResultsProvider(1, new Date("2026-08-23T23:00Z"))
    .fetchSettledForSports(["TENNIS"], { tennisEventDates: ["20260823"] });
  assert.equal(games.length, 1);
});
