import assert from "node:assert/strict";
import test from "node:test";

import {
  matchupLabel,
  pickContextLabel,
  pickEventDate,
  propMarketDisplayLabel,
  selectionWithMarket,
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

/**
 * Owner report, 2026-11-11: the ticket and the pick history both read
 * "Davion Mitchell Over 21.5" — nothing said 21.5 of what. The stat was only
 * in `market` ("Pts+Ast").
 */
test("a player prop names the stat it settles on", () => {
  assert.equal(
    selectionWithMarket({
      selection: "Davion Mitchell Over 21.5",
      market: "Pts+Ast",
    }),
    "Davion Mitchell Over 21.5 Points + Assists",
  );
  assert.equal(
    selectionWithMarket({
      selection: "Michael Wacha Over 15.5",
      market: "Outs",
    }),
    "Michael Wacha Over 15.5 Outs",
  );
  assert.equal(
    selectionWithMarket({
      selection: "Josh Allen Under 245.5",
      market: "Passing Yds",
    }),
    "Josh Allen Under 245.5 Passing Yards",
  );
});

test("selections that already say what they are stay as written", () => {
  // Lineless props carry the market in the selection already.
  assert.equal(
    selectionWithMarket({
      selection: "Josh Allen Anytime Touchdown",
      market: "Anytime Touchdown",
    }),
    "Josh Allen Anytime Touchdown",
  );
  // Game lines, team totals and legacy free-text picks are untouched.
  for (const [selection, market] of [
    ["Lakers -4.5", "Spread"],
    ["Over 220.5", "Total"],
    ["Nationals TT O4.5", "Team Total"],
    ["Davion Mitchell Over 21.5 Pts + Ast", "Player Prop"],
    ["Yankees", "Moneyline"],
  ] as const) {
    assert.equal(selectionWithMarket({ selection, market }), selection);
  }
  assert.equal(
    selectionWithMarket({ selection: "Celtics ML", market: null }),
    "Celtics ML",
  );
});

test("only board player-prop labels read as a prop stat", () => {
  assert.equal(
    propMarketDisplayLabel("Pts+Reb+Ast"),
    "Points + Rebounds + Assists",
  );
  assert.equal(propMarketDisplayLabel("Rebounds"), "Rebounds");
  assert.equal(propMarketDisplayLabel("Total"), null);
  assert.equal(propMarketDisplayLabel("Player Prop"), null);
  assert.equal(propMarketDisplayLabel(undefined), null);
});
