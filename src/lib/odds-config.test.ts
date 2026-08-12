import assert from "node:assert/strict";
import test from "node:test";
import { oddsApiKeys } from "./odds-config";

test("existing Odds API key remains first and fallback is deduplicated", () => {
  assert.deepEqual(oddsApiKeys({ ODD_API_KEY: "old", ODDS_API_KEY_FALLBACK: "new" }), ["old", "new"]);
  assert.deepEqual(oddsApiKeys({ ODDS_API_KEY: "same", ODDS_API_KEY_FALLBACK: "same" }), ["same"]);
});
