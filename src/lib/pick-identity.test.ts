import assert from "node:assert/strict";
import test from "node:test";

import {
  matchupLabel,
  pickContextLabel,
  pickEventDate,
  teamIdentityFromSide,
} from "@/lib/pick-identity";

test("matchupLabel prefers the stored label, then the stored fixture", () => {
  // Board picks logged since the matchup started being recorded.
  assert.equal(
    matchupLabel({ eventLabel: "Texas Rangers @ Los Angeles Angels" }),
    "Texas Rangers @ Los Angeles Angels",
  );

  // Older board picks kept home/away without ever writing a label.
  assert.equal(
    matchupLabel({ homeTeam: "Los Angeles Angels", awayTeam: "Texas Rangers" }),
    "Texas Rangers @ Los Angeles Angels",
  );

  // A stored label wins over reconstruction.
  assert.equal(
    matchupLabel({
      eventLabel: "Stored Label",
      homeTeam: "Home",
      awayTeam: "Away",
    }),
    "Stored Label",
  );

  // Half a fixture is not a matchup — the caller falls back to the market.
  assert.equal(matchupLabel({ homeTeam: "Los Angeles Angels" }), null);
  assert.equal(matchupLabel({ awayTeam: "Texas Rangers" }), null);
  assert.equal(matchupLabel({}), null);
  assert.equal(matchupLabel({ eventLabel: "   " }), null);
});

test("pickEventDate falls back to createdAt for imported picks", () => {
  const start = new Date("2026-08-11T23:05:00.000Z");
  const created = new Date("2026-08-11T18:00:00.000Z");

  // A board pick knows its own start.
  assert.equal(
    pickEventDate({ eventStartsAt: start, createdAt: created }),
    start,
  );

  // An imported legacy pick has no start, and its createdAt IS the event time —
  // the extractor derives it from the source row's date and time. Same rule the
  // grader uses in results/match.ts.
  assert.equal(
    pickEventDate({ eventStartsAt: null, createdAt: created }),
    created,
  );
  assert.equal(pickEventDate({ createdAt: created }), created);

  // Nothing to show rather than something invented.
  assert.equal(pickEventDate({ eventStartsAt: null, createdAt: null }), null);
  assert.equal(pickEventDate({}), null);
});

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
