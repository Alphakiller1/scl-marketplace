import assert from "node:assert/strict";
import { test } from "node:test";

import {
  parseWhopPkceCookie,
  serializeWhopPkceCookie,
  whopOAuthCookieDomain,
  whopOAuthReturnOrigin,
} from "@/lib/whop-oauth-cookie";
import { generatePkceState } from "@/lib/whop-oauth";

test("the PKCE handoff is shared only across SCL's public hosts", () => {
  assert.equal(
    whopOAuthCookieDomain("https://www.sportscappersleaderboard.com"),
    "sportscappersleaderboard.com",
  );
  assert.equal(
    whopOAuthCookieDomain("https://sportscappersleaderboard.com"),
    "sportscappersleaderboard.com",
  );
  assert.equal(whopOAuthCookieDomain("https://attacker.example"), undefined);
  assert.equal(whopOAuthCookieDomain("http://localhost:3000"), undefined);
});

test("signed PKCE state round-trips and rejects tampering", () => {
  const pkce = generatePkceState(
    "capper-1",
    "connection-1",
    "https://www.sportscappersleaderboard.com",
  );
  const serialized = serializeWhopPkceCookie(pkce, "test-secret");

  assert.deepEqual(parseWhopPkceCookie(serialized, "test-secret"), pkce);
  assert.equal(
    parseWhopPkceCookie(`${serialized.slice(0, -1)}x`, "test-secret"),
    null,
  );
  assert.equal(parseWhopPkceCookie(serialized, "wrong-secret"), null);
});

test("the callback returns to www but rejects an untrusted cookie origin", () => {
  assert.equal(
    whopOAuthReturnOrigin(
      "https://www.sportscappersleaderboard.com/dashboard/monetization",
      "https://sportscappersleaderboard.com",
    ),
    "https://www.sportscappersleaderboard.com",
  );
  assert.equal(
    whopOAuthReturnOrigin(
      "https://attacker.example/steal",
      "https://sportscappersleaderboard.com",
    ),
    "https://sportscappersleaderboard.com",
  );
});
