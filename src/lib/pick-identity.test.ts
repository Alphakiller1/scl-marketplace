import assert from "node:assert/strict";
import test from "node:test";

import { pickContextLabel, teamIdentityFromSide } from "@/lib/pick-identity";

test("teamIdentityFromSide resolves known board sides only", () => {
  const dodgers = teamIdentityFromSide("Los Angeles Dodgers", "MLB");
  assert.equal(dodgers?.abbr, "LAD");

  assert.equal(teamIdentityFromSide("Over", "MLB"), null);
  assert.equal(teamIdentityFromSide("Under", "MLB"), null);
  assert.equal(teamIdentityFromSide("Mystery City Meteors", "MLB"), null);
  assert.equal(teamIdentityFromSide("", "MLB"), null);
  assert.equal(teamIdentityFromSide(null, "MLB"), null);
});

test("teamIdentityFromSide never guesses across sports", () => {
  // "Seattle" alone is an alias in both maps when sport is scoped — require sport match.
  assert.equal(teamIdentityFromSide("Seattle Mariners", "WNBA"), null);
  assert.equal(teamIdentityFromSide("Seattle Storm", "MLB"), null);
  assert.equal(teamIdentityFromSide("Seattle Storm", "WNBA")?.abbr, "SEA");
});

test("pickContextLabel drops duplicate sport/league labels", () => {
  assert.equal(
    pickContextLabel({ sport: "MLB", league: "MLB", market: "Moneyline" }),
    "Moneyline",
  );
  assert.equal(
    pickContextLabel({ sport: "MLB", league: null, market: "Spread" }),
    "Spread",
  );
  assert.equal(
    pickContextLabel({
      sport: "NBA",
      league: "Summer League",
      market: "Moneyline",
    }),
    "Summer League · Moneyline",
  );
  assert.equal(
    pickContextLabel({ sport: "NFL", league: "Spread", market: "Spread" }),
    "Spread",
  );
});

test("pickContextLabel renders nothing when market is only the sport or league", () => {
  assert.equal(
    pickContextLabel({ sport: "MLB", league: "MLB", market: "MLB" }),
    "",
  );
  assert.equal(
    pickContextLabel({
      sport: "MLB",
      league: "First Five Innings",
      market: "First Five Innings",
    }),
    "",
  );
  assert.equal(
    pickContextLabel({ sport: "WNBA", league: null, market: "WNBA" }),
    "",
  );
});
