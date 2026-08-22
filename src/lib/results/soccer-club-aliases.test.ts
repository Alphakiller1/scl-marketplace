import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalSoccerClubName,
  soccerClubAliases,
} from "@/lib/results/soccer-club-aliases";

test("Internazionale and Inter Milan are the same club", () => {
  assert.equal(canonicalSoccerClubName("Internazionale"), "Inter Milan");
  assert.equal(canonicalSoccerClubName("FC Internazionale"), "Inter Milan");
  assert.ok(soccerClubAliases("Internazionale").includes("Inter Milan"));
  assert.ok(soccerClubAliases("Inter Milan").includes("Internazionale"));
});

test("Inter Miami is not Internazionale", () => {
  assert.equal(canonicalSoccerClubName("Inter Miami"), "Inter Miami");
  assert.equal(canonicalSoccerClubName("Inter Miami CF"), "Inter Miami CF");
  assert.equal(
    soccerClubAliases("Inter Miami").includes("Internazionale"),
    false,
  );
});

test("unknown clubs pass through", () => {
  assert.equal(canonicalSoccerClubName("Monza"), "Monza");
  assert.deepEqual(soccerClubAliases("Monza"), ["Monza"]);
});
