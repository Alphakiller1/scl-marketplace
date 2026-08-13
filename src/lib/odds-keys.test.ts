import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  liveOddsApiKeys,
  markOddsKeyExhausted,
  nextOddsApiKey,
  parseOddsApiKeys,
  resetOddsKeyRotation,
} from "@/lib/odds-keys";

beforeEach(() => resetOddsKeyRotation());

test("reads every supported env var in priority order", () => {
  const env = {
    ODD_API_KEY: "misspelled",
    ODDS_API_KEY: "primary",
    ODDS_API_KEY_FALLBACK: "fallback",
  };
  assert.deepEqual(parseOddsApiKeys(env), [
    "primary",
    "fallback",
    "misspelled",
  ]);
});

test("ODDS_API_KEY_FALLBACK is actually read", () => {
  // The regression this module exists for: the var was set by hand during an
  // outage and read by nothing, so the key meant to take over never was.
  assert.deepEqual(parseOddsApiKeys({ ODDS_API_KEY_FALLBACK: "rescue" }), [
    "rescue",
  ]);
});

test("the canonical var takes a comma-separated list", () => {
  assert.deepEqual(parseOddsApiKeys({ ODDS_API_KEYS: " a , b ,, c " }), [
    "a",
    "b",
    "c",
  ]);
});

test("the canonical list outranks the legacy singles", () => {
  // An exhausted key is still a valid string, so if it sorted first it would
  // win forever and the fresh key would never be reached.
  const env = { ODDS_API_KEYS: "fresh", ODDS_API_KEY: "spent" };
  assert.deepEqual(parseOddsApiKeys(env), ["fresh", "spent"]);
  assert.equal(nextOddsApiKey(env), "fresh");
});

test("the same key set twice is spent once", () => {
  const env = { ODDS_API_KEYS: "dup", ODDS_API_KEY_2: "dup", ODD_API_KEY: "x" };
  assert.deepEqual(parseOddsApiKeys(env), ["dup", "x"]);
});

test("no configuration yields no key rather than an empty string", () => {
  assert.deepEqual(parseOddsApiKeys({}), []);
  assert.equal(nextOddsApiKey({}), undefined);
  assert.equal(nextOddsApiKey({ ODDS_API_KEY: "   " }), undefined);
});

test("an exhausted key steps aside for the next one", () => {
  const env = { ODDS_API_KEYS: "first,second" };
  assert.equal(nextOddsApiKey(env), "first");

  markOddsKeyExhausted("first", "HTTP 401");
  assert.equal(nextOddsApiKey(env), "second");
  assert.deepEqual(liveOddsApiKeys(env), ["second"]);
});

test("with every key spent it still returns one, so the caller sees a real error", () => {
  const env = { ODDS_API_KEYS: "only" };
  markOddsKeyExhausted("only", "HTTP 429");
  assert.deepEqual(liveOddsApiKeys(env), []);
  // Not undefined: reporting "unconfigured" would send an operator looking for
  // a missing env var instead of an exhausted plan.
  assert.equal(nextOddsApiKey(env), "only");
});

test("writing off a key twice is a no-op", () => {
  const env = { ODDS_API_KEYS: "a,b" };
  markOddsKeyExhausted("a", "HTTP 401");
  markOddsKeyExhausted("a", "HTTP 401");
  assert.deepEqual(liveOddsApiKeys(env), ["b"]);
});

test("rotation resets, because quota does", () => {
  const env = { ODDS_API_KEYS: "a" };
  markOddsKeyExhausted("a", "spent");
  assert.deepEqual(liveOddsApiKeys(env), []);
  resetOddsKeyRotation();
  assert.deepEqual(liveOddsApiKeys(env), ["a"]);
});
