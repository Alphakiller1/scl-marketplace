import assert from "node:assert/strict";
import test from "node:test";

import { oddsApiKey } from "@/lib/odds-config";

test("odds provider accepts the canonical and deployed legacy key names", () => {
  assert.equal(oddsApiKey({ ODDS_API_KEY: " canonical " }), "canonical");
  assert.equal(oddsApiKey({ ODD_API_KEY: " legacy " }), "legacy");
  assert.equal(
    oddsApiKey({ ODDS_API_KEY: "canonical", ODD_API_KEY: "legacy" }),
    "canonical",
  );
  assert.equal(oddsApiKey({}), undefined);
});
