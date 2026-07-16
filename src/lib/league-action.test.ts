import assert from "node:assert/strict";
import test from "node:test";

import {
  leagueInitials,
  rankLeagueAction,
  rankLeagueActionCategories,
} from "@/lib/league-action";

test("rankLeagueAction groups by league fallback and ranks by pick volume", () => {
  const leagues = rankLeagueAction([
    { sport: "MLB", league: "MLB", capperId: "c1" },
    { sport: "MLB", league: "MLB", capperId: "c2" },
    { sport: "WNBA", league: null, capperId: "c1" },
    { sport: "WNBA", league: "WNBA", capperId: "c1" },
    { sport: "NBA", league: "NBA", capperId: "c3" },
  ]);

  assert.deepEqual(leagues, [
    {
      key: "MLB:MLB",
      sport: "MLB",
      league: "MLB",
      pickCount: 2,
      activeCappers: 2,
    },
    {
      key: "WNBA:WNBA",
      sport: "WNBA",
      league: "WNBA",
      pickCount: 2,
      activeCappers: 1,
    },
    {
      key: "NBA:NBA",
      sport: "NBA",
      league: "NBA",
      pickCount: 1,
      activeCappers: 1,
    },
  ]);
});

test("rankLeagueActionCategories buckets singles, sides, totals, and parlays", () => {
  const categories = rankLeagueActionCategories(
    [
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c1",
        market: "Moneyline",
        parlayId: null,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c1",
        market: "Spread",
        parlayId: null,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c2",
        market: "Total",
        parlayId: null,
      },
      {
        sport: "NBA",
        league: "NBA",
        capperId: "c2",
        market: "Player Props",
        parlayId: null,
      },
      {
        sport: "MLB",
        league: "MLB",
        capperId: "c3",
        market: "Moneyline",
        parlayId: "parlay-1",
      },
    ],
    [{ capperId: "c4" }, { capperId: "c4" }],
  );

  const byKey = Object.fromEntries(categories.map((c) => [c.key, c]));
  assert.equal(byKey.sides?.picks, 2);
  assert.equal(byKey.totals?.picks, 1);
  assert.equal(byKey.props?.picks, 1);
  assert.equal(byKey.parlays?.picks, 2);
  assert.equal(byKey.parlays?.cappers, 1);
});

test("leagueInitials creates compact temporary marks", () => {
  assert.equal(leagueInitials("Major League Baseball"), "MLB");
  assert.equal(leagueInitials("WNBA"), "WNBA");
  assert.equal(leagueInitials(""), "SCL");
});
