import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchWithOddsKeyRollover,
  isProviderRefusal,
  PROVIDER_REFUSED_STATUSES,
  resetOddsKeyPreferenceForTests,
  setOddsKeyChangeHandler,
} from "@/lib/odds-key-rollover";

/**
 * These guard the distinction that cost five days of ungraded plays.
 *
 * On 2026-08-10 every Odds API key on the account reached its 500-request
 * monthly cap. The provider answered the scores endpoint with 401 — verified
 * against the live API: a key reading `x-requests-used: 500` still returns 200
 * on the free `/v4/sports/` listing but 401 on any metered endpoint. The
 * results provider read that 401, logged it, and returned `[]`, which the
 * grader could not tell apart from "no games finished today". Nothing failed,
 * so nothing alerted, and plays sat pending until someone looked.
 *
 * The rule these lock in: a refusal is about the ACCOUNT and is fatal to the
 * run; any other non-OK status belongs to the one request and is skippable.
 */

test("quota exhaustion and bad credentials both count as provider refusal", () => {
  // The Odds API signals a spent quota with 401, NOT 429 — do not "fix" this
  // list to match the usual REST convention.
  for (const status of [401, 402, 403, 429]) {
    assert.equal(
      isProviderRefusal(status),
      true,
      `HTTP ${status} must be treated as the account being refused`,
    );
  }
  assert.deepEqual([...PROVIDER_REFUSED_STATUSES], [401, 402, 403, 429]);
});

test("a per-request failure is not a refusal, so one sport cannot abort a run", () => {
  // 404 is an out-of-season or misspelled sport key; 5xx is a provider blip.
  // Both must stay skippable or a single dead league takes the whole slate.
  for (const status of [200, 404, 422, 500, 502, 503]) {
    assert.equal(
      isProviderRefusal(status),
      false,
      `HTTP ${status} must remain a skippable per-request failure`,
    );
  }
});

test("rollover returns the final refusal once every key is spent", async () => {
  process.env.ODDS_API_KEY = "spent-one";
  process.env.ODDS_API_KEY_FALLBACK = "spent-two";
  delete process.env.ODDS_API_KEY_2;
  delete process.env.ODDS_API_KEYS;
  delete process.env.ODD_API_KEY;
  resetOddsKeyPreferenceForTests();

  const tried: string[] = [];
  const result = await fetchWithOddsKeyRollover(
    (key) => {
      tried.push(key);
      return `https://example.test/?apiKey=${key}`;
    },
    undefined,
    async () => new Response("", { status: 401 }),
  );

  // Every key is offered before giving up — that is what makes the surviving
  // 401 mean "the account is refused" rather than "this one key is bad".
  assert.deepEqual(tried, ["spent-one", "spent-two"]);
  assert.equal(result.response?.status, 401);
  assert.equal(
    isProviderRefusal(result.response!.status),
    true,
    "the status handed back after full rollover must read as a refusal",
  );
});

test("a healthy key short-circuits rollover and never reaches the fallback", async () => {
  process.env.ODDS_API_KEY = "good-one";
  process.env.ODDS_API_KEY_FALLBACK = "spent-two";
  delete process.env.ODDS_API_KEY_2;
  delete process.env.ODDS_API_KEYS;
  delete process.env.ODD_API_KEY;
  resetOddsKeyPreferenceForTests();

  const tried: string[] = [];
  const result = await fetchWithOddsKeyRollover(
    (key) => {
      tried.push(key);
      return `https://example.test/?apiKey=${key}`;
    },
    undefined,
    async () =>
      new Response("[]", {
        status: 200,
        headers: { "x-requests-remaining": "497" },
      }),
  );

  assert.deepEqual(tried, ["good-one"]);
  assert.equal(result.rolledOver, false);
  assert.equal(isProviderRefusal(result.response!.status), false);
});

test("a transient 429 keeps the healthy key preferred and does not burn a fallback", async () => {
  process.env.ODDS_API_KEY = "rate-limited";
  process.env.ODDS_API_KEY_FALLBACK = "fallback";
  delete process.env.ODDS_API_KEY_2;
  delete process.env.ODDS_API_KEYS;
  delete process.env.ODD_API_KEY;
  resetOddsKeyPreferenceForTests();

  const tried: string[] = [];
  const result = await fetchWithOddsKeyRollover(
    (key) => {
      tried.push(key);
      return `https://example.test/?apiKey=${key}`;
    },
    undefined,
    async () => new Response("", { status: 429 }),
  );

  assert.deepEqual(tried, ["rate-limited"]);
  assert.equal(result.response?.status, 429);
  assert.equal(result.rolledOver, false);
});

/**
 * A spent key at the front of the rotation must not freeze the funded ones.
 *
 * The circuit breaker reads the last observed `x-requests-remaining` and runs
 * BEFORE any request. Once a 500-credit key reported -2, every later board
 * fetch was refused without a call, so `fetchWithOddsKeyRollover` was never
 * reached and the 97,000-credit key one index away was never tried. The board
 * froze on last-good prices while credit sat unused.
 */
test("moving off a spent key clears the balance the breaker judges by", async () => {
  resetOddsKeyPreferenceForTests();
  // `oddsApiKeys()` also reads ODDS_API_KEY_FALLBACK and ODDS_API_KEY_2, so a
  // value left behind by an earlier test lands between these two and shifts
  // every index. Clear the whole set, not just the two this test sets.
  for (const name of [
    "ODDS_API_KEY",
    "ODD_API_KEY",
    "ODDS_API_KEY_FALLBACK",
    "ODDS_API_KEY_2",
    "ODDS_API_KEYS",
  ]) {
    delete process.env[name];
  }
  process.env.ODDS_API_KEY = "spent-500";
  process.env.ODDS_API_KEYS = "spent-500,funded-97k";

  let cleared = 0;
  setOddsKeyChangeHandler(() => {
    cleared += 1;
  });

  const used: string[] = [];
  const spentThenFunded: typeof fetch = async (input) => {
    const url = String(input);
    used.push(url.includes("funded-97k") ? "funded" : "spent");
    // The shape that hid this: HTTP 200, so `shouldRollOver` is false, but the
    // key has nothing left. It is consumed and the NEXT request must move on.
    return new Response("[]", {
      status: 200,
      headers: { "x-requests-remaining": "-2", "x-requests-used": "502" },
    });
  };

  const first = await fetchWithOddsKeyRollover(
    (key) => `https://api.the-odds-api.com/v4/sports/x/odds/?apiKey=${key}`,
    undefined,
    spentThenFunded,
  );
  assert.equal(first.keyIndex, 0);
  assert.deepEqual(used, ["spent"]);
  // The preferred key moved, so the stale -2 must have been cleared — that is
  // what lets the breaker try the funded key at all.
  assert.equal(cleared, 1, "rollover did not clear the previous key's balance");

  const second = await fetchWithOddsKeyRollover(
    (key) => `https://api.the-odds-api.com/v4/sports/x/odds/?apiKey=${key}`,
    undefined,
    spentThenFunded,
  );
  assert.equal(second.keyIndex, 1);
  assert.deepEqual(used, ["spent", "funded"]);

  setOddsKeyChangeHandler(undefined);
  resetOddsKeyPreferenceForTests();
  delete process.env.ODDS_API_KEY;
  delete process.env.ODDS_API_KEYS;
});
