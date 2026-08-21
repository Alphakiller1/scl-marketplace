import assert from "node:assert/strict";
import { test } from "node:test";

import { mapCflScheduleHtml } from "@/lib/results/cfl-ca-map";
import {
  findGame,
  resolveOutcome,
  type GradablePlay,
} from "@/lib/results/match";

const CFL_CA_GAME = `
<div id="div-game-id-6633" class="heading collapsible-header">
  <script>var int_timestamp = Number(1787268600) * 1000;</script>
  <span class="status">Final</span>
  <span class="visitor"><span class="text">OTT</span></span>
  <span class="visitor-score">16</span>
  <span class="versus">@</span>
  <span class="host-score">46</span>
  <span class="host"><span class="text">MTL</span></span>
  <div class="city js-data-team_2_location">OTTAWA</div>
  <div class="team js-data-team_2_nickname">REDBLACKS</div>
  <div class="city js-data-team_1_location">MONTREAL</div>
  <div class="team js-data-team_1_nickname">Alouettes</div>
</div>
<div id="div-game-id-6634" class="heading collapsible-header">
  <span class="status">7:30 pm</span>
  <span class="visitor"><span class="text">WPG</span></span>
  <span class="visitor-score"></span>
  <span class="host"><span class="text">EDM</span></span>
</div>
`;

test("CFL.ca schedule HTML maps completed finals and skips live games", () => {
  const games = mapCflScheduleHtml(CFL_CA_GAME);
  assert.equal(games.length, 1);
  assert.equal(games[0]!.sport, "CFL");
  assert.equal(games[0]!.home, "Montreal Alouettes");
  assert.equal(games[0]!.away, "Ottawa Redblacks");
  assert.equal(games[0]!.homeScore, 46);
  assert.equal(games[0]!.awayScore, 16);
  assert.equal(games[0]!.eventId, "cflca:6633");
  assert.equal(games[0]!.startsAt?.toISOString(), "2026-08-20T23:30:00.000Z");
});

test("a bound CFL spread grades from the CFL.ca final", () => {
  const games = mapCflScheduleHtml(CFL_CA_GAME);
  const play: GradablePlay = {
    id: "cfl-1",
    sport: "CFL",
    market: "Spread",
    selection: "Montreal Alouettes -12.5",
    oddsAmerican: -115,
    units: 5,
    eventId: "60cd454e14079f716975f59f954fe8c1",
    eventLabel: "Ottawa Redblacks @ Montreal Alouettes",
    homeTeam: "Montreal Alouettes",
    awayTeam: "Ottawa Redblacks",
    eventStartsAt: new Date("2026-08-20T23:30:00.000Z"),
  };
  assert.equal(findGame(play, games)?.eventId, "cflca:6633");
  assert.equal(resolveOutcome(play, games), "WIN");
  assert.equal(
    resolveOutcome({ ...play, selection: "Montreal Alouettes -10.5" }, games),
    "WIN",
  );
});
