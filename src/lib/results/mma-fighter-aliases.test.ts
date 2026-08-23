import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalMmaFighterName,
  mmaFighterAliases,
} from "@/lib/results/mma-fighter-aliases";

test("Serghei Spivac and Sergey Spivak are the same fighter", () => {
  assert.equal(canonicalMmaFighterName("Serghei Spivac"), "Sergey Spivak");
  assert.equal(canonicalMmaFighterName("Sergei Spivak"), "Sergey Spivak");
  assert.ok(mmaFighterAliases("Serghei Spivac").includes("Sergey Spivak"));
  assert.ok(mmaFighterAliases("Sergey Spivak").includes("Serghei Spivac"));
});

test("unknown fighters pass through", () => {
  assert.equal(canonicalMmaFighterName("Vitor Petrino"), "Vitor Petrino");
  assert.deepEqual(mmaFighterAliases("Vitor Petrino"), ["Vitor Petrino"]);
});
