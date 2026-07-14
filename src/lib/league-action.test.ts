import assert from "node:assert/strict";
import test from "node:test";

import { leagueInitials, rankLeagueAction } from "@/lib/league-action";

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

test("leagueInitials creates compact temporary marks", () => {
  assert.equal(leagueInitials("Major League Baseball"), "MLB");
  assert.equal(leagueInitials("WNBA"), "WNBA");
  assert.equal(leagueInitials(""), "SCL");
});
