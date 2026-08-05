import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildWhopAuthorizeUrl,
  generatePkceState,
  pkceCodeChallenge,
} from "@/lib/whop-oauth";

describe("whop oauth helpers", () => {
  it("generates stable-length PKCE material", () => {
    const pkce = generatePkceState("capper-1", "conn-1");
    assert.ok(pkce.codeVerifier.length >= 32);
    assert.ok(pkce.state.length >= 16);
    assert.equal(pkce.capperProfileId, "capper-1");
    assert.equal(pkce.connectionId, "conn-1");
  });

  it("builds an authorize URL with PKCE params", () => {
    const pkce = generatePkceState("capper-1", "conn-1");
    const url = buildWhopAuthorizeUrl({
      clientId: "app_test",
      redirectUri: "https://sportscappersleaderboard.com/api/whop/callback",
      pkce,
    });
    const parsed = new URL(url);
    assert.equal(parsed.hostname, "api.whop.com");
    assert.equal(parsed.pathname, "/oauth/authorize");
    assert.equal(parsed.searchParams.get("client_id"), "app_test");
    assert.equal(
      parsed.searchParams.get("code_challenge"),
      pkceCodeChallenge(pkce.codeVerifier),
    );
    assert.equal(parsed.searchParams.get("code_challenge_method"), "S256");
  });
});
