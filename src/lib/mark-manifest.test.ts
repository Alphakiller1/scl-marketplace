import assert from "node:assert/strict";
import test from "node:test";

import { leagueMarkSrc, teamMarkSrc } from "@/lib/mark-manifest";

test("leagueMarkSrc returns undefined when manifest has no entry", () => {
  assert.equal(leagueMarkSrc("MLB"), undefined);
  assert.equal(leagueMarkSrc(""), undefined);
});

test("teamMarkSrc returns undefined when manifest has no entry", () => {
  assert.equal(teamMarkSrc("MLB", "LAD"), undefined);
  assert.equal(teamMarkSrc("MLB", ""), undefined);
});
