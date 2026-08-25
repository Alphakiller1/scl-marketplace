import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  SCL_WHOP_AFFILIATE_USERNAME,
  SCL_WHOP_APP_ID,
  isSclWhopAffiliateUsername,
  whopStorefrontApiKey,
  whopAffiliateUsername,
  whopAppId,
  whopIntegrationStatus,
  whopOAuthConfigured,
} from "@/lib/whop-config";

const ORIGINAL = {
  appId: process.env.NEXT_PUBLIC_WHOP_APP_ID,
  whopAppId: process.env.WHOP_APP_ID,
  affiliate: process.env.WHOP_AFFILIATE_USERNAME,
  appApiKey: process.env.WHOP_APP_API_KEY,
  webhook: process.env.WHOP_WEBHOOK_SECRET,
  account: process.env.WHOP_API_KEY,
};

afterEach(() => {
  process.env.NEXT_PUBLIC_WHOP_APP_ID = ORIGINAL.appId;
  process.env.WHOP_APP_ID = ORIGINAL.whopAppId;
  process.env.WHOP_AFFILIATE_USERNAME = ORIGINAL.affiliate;
  process.env.WHOP_APP_API_KEY = ORIGINAL.appApiKey;
  process.env.WHOP_WEBHOOK_SECRET = ORIGINAL.webhook;
  process.env.WHOP_API_KEY = ORIGINAL.account;
});

describe("whop-config defaults", () => {
  it("falls back to the public SCL OAuth client ID and affiliate username", () => {
    delete process.env.NEXT_PUBLIC_WHOP_APP_ID;
    delete process.env.WHOP_APP_ID;
    delete process.env.WHOP_AFFILIATE_USERNAME;

    assert.equal(whopAppId(), SCL_WHOP_APP_ID);
    assert.equal(whopAffiliateUsername(), SCL_WHOP_AFFILIATE_USERNAME);
    assert.equal(SCL_WHOP_AFFILIATE_USERNAME, "scleaderboard");
    assert.equal(isSclWhopAffiliateUsername("scleaderboard"), true);
    assert.equal(isSclWhopAffiliateUsername("SportsCappersLeaderboard"), true);
  });

  it("prefers explicit env overrides over defaults", () => {
    delete process.env.NEXT_PUBLIC_WHOP_APP_ID;
    process.env.WHOP_APP_ID = "app_override";
    process.env.WHOP_AFFILIATE_USERNAME = "override";

    assert.equal(whopAppId(), "app_override");
    assert.equal(whopAffiliateUsername(), "override");
  });

  it("requires the app api key for oauth", () => {
    delete process.env.WHOP_APP_API_KEY;
    delete process.env.WHOP_CLIENT_SECRET;
    delete process.env.NEXT_PUBLIC_WHOP_APP_ID;
    delete process.env.WHOP_APP_ID;

    assert.equal(whopOAuthConfigured(), false);

    process.env.WHOP_APP_API_KEY = "apik_test";
    assert.equal(whopOAuthConfigured(), true);
  });

  it("reports storefront sync when oauth and affiliate are ready", () => {
    process.env.WHOP_APP_API_KEY = "apik_test";
    process.env.WHOP_WEBHOOK_SECRET = "ws_test";
    process.env.WHOP_API_KEY = "apik_account";
    delete process.env.WHOP_AFFILIATE_USERNAME;

    const status = whopIntegrationStatus();
    assert.equal(status.affiliateUsername, true);
    assert.equal(status.oauth, true);
    assert.equal(status.storefrontSync, true);
  });

  it("prefers Whop's current server-key env name for storefront operations", () => {
    process.env.WHOP_API_KEY = "apik_server";
    process.env.WHOP_APP_API_KEY = "apik_legacy_app";

    assert.equal(whopStorefrontApiKey("oauth_user"), "apik_server");
  });

  it("accepts the legacy app-key env name for storefront operations", () => {
    delete process.env.WHOP_API_KEY;
    process.env.WHOP_APP_API_KEY = "apik_legacy_app";

    assert.equal(whopStorefrontApiKey("oauth_user"), "apik_legacy_app");
  });

  it("keeps OAuth credentials as a backwards-compatible fallback", () => {
    delete process.env.WHOP_API_KEY;
    delete process.env.WHOP_APP_API_KEY;
    delete process.env.WHOP_CLIENT_SECRET;

    assert.equal(whopStorefrontApiKey("oauth_user"), "oauth_user");
    assert.equal(whopStorefrontApiKey(null), null);
  });
});
