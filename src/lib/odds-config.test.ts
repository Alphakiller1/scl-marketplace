import assert from "node:assert/strict";
import test from "node:test";
import { oddsApiKeys, withOddsApiKey } from "./odds-config";

test("existing Odds API key remains first and fallback is deduplicated", () => {
  assert.deepEqual(
    oddsApiKeys({ ODD_API_KEY: "old", ODDS_API_KEY_FALLBACK: "new" }),
    ["old", "new"],
  );
  assert.deepEqual(
    oddsApiKeys({ ODDS_API_KEY: "same", ODDS_API_KEY_FALLBACK: "same" }),
    ["same"],
  );
});

test("ODDS_API_KEYS adds capacity without a deploy", () => {
  // The outage this covers: a replacement key was put in the environment while
  // both read names were exhausted, so the app never reached it and every board
  // stayed empty — identical to having no key at all.
  assert.deepEqual(
    oddsApiKeys({ ODDS_API_KEY: "spent", ODDS_API_KEYS: " third , fourth " }),
    ["spent", "third", "fourth"],
  );
  // Read last on purpose: the singles above may still have credit, and rollover
  // is meant to burn those down first.
  assert.deepEqual(
    oddsApiKeys({
      ODDS_API_KEY: "primary",
      ODDS_API_KEY_FALLBACK: "fallback",
      ODDS_API_KEY_2: "second",
      ODDS_API_KEYS: "listed",
    }),
    ["primary", "fallback", "second", "listed"],
  );
  // A key repeated across names is still spent once.
  assert.deepEqual(
    oddsApiKeys({ ODDS_API_KEY: "dup", ODDS_API_KEYS: "dup,other" }),
    ["dup", "other"],
  );
  // Empty entries and stray commas never become a request with a blank key.
  assert.deepEqual(oddsApiKeys({ ODDS_API_KEYS: " , ,, " }), []);
  assert.deepEqual(oddsApiKeys({}), []);
});

test("withOddsApiKey scopes a one-shot key without changing shared keys", async () => {
  const env: Record<string, string | undefined> = {
    ODDS_API_KEY: "spent",
    ODDS_API_KEY_FALLBACK: "also-spent",
    ODDS_API_KEYS: "third",
  };
  const sharedKeys = oddsApiKeys();
  const request = withOddsApiKey(" temp-key ", async () => {
    assert.deepEqual(oddsApiKeys(), ["temp-key"]);
    assert.deepEqual(oddsApiKeys(env), ["spent", "also-spent", "third"]);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(oddsApiKeys(), ["temp-key"]);
  });

  assert.deepEqual(oddsApiKeys(), sharedKeys);
  await request;
  assert.deepEqual(oddsApiKeys(), sharedKeys);
});
