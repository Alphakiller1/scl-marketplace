import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWhopCheckoutUrl,
  isWhopCreatorReferralUrl,
  whopAffiliateParamIssues,
} from "@/lib/whop-affiliate";
import { WHOP_CAPPER_REFERRAL_URL } from "@/lib/store-connection";

describe("whop affiliate URL validation", () => {
  it("recognises Whop checkout hosts", () => {
    assert.equal(isWhopCheckoutUrl("https://whop.com/some-capper/plan"), true);
    assert.equal(
      isWhopCheckoutUrl("https://checkout.whop.com/pay/plan_abc"),
      true,
    );
    assert.equal(isWhopCheckoutUrl("https://winible.com/x"), false);
  });

  it("flags missing affiliate parameter", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/some-capper/plan",
      "sportscappersleaderboard",
    );
    assert.match(issues[0] || "", /Missing \?a=/);
  });

  it("flags HTML-escaped affiliate parameter", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/x?amp;a=sportscappersleaderboard",
    );
    assert.match(issues[0] || "", /HTML-escaped/);
  });

  it("flags wrong affiliate username when configured", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/x?a=wronguser",
      "scleaderboard",
    );
    assert.match(issues[0] || "", /expects "scleaderboard"/);
  });

  it("passes the canonical scl affiliate slug", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/x?a=scleaderboard",
      "scleaderboard",
    );
    assert.deepEqual(issues, []);
  });

  it("accepts legacy SportsCappersLeaderboard slug in checkout urls", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/x?a=SportsCappersLeaderboard",
      "scleaderboard",
    );
    assert.deepEqual(issues, []);
  });
});

describe("SCL's Whop creator referral is not a checkout link", () => {
  // The referral (whop.com/network) and SCL's affiliate relationship (the `?a=`
  // parameter) are separate things. A real capper checkout link is *supposed*
  // to carry ?a=scleaderboard — that is how SCL earns its commission — so the
  // guard keys on the /network path and must never key on the slug.
  it("rejects the onboarding referral with a message that says why", () => {
    for (const url of [
      WHOP_CAPPER_REFERRAL_URL,
      "https://whop.com/network?a=scleaderboard",
      "https://www.whop.com/network/",
    ]) {
      assert.equal(isWhopCreatorReferralUrl(url), true, url);
      assert.equal(isWhopCheckoutUrl(url), false, url);
      assert.deepEqual(whopAffiliateParamIssues(url, "scleaderboard"), [
        "This is SCL's Whop creator-onboarding referral, not a customer checkout link.",
      ]);
    }
  });

  it("leaves genuine affiliate checkout links alone", () => {
    for (const url of [
      "https://whop.com/some-capper/vip-plan?a=scleaderboard",
      "https://checkout.whop.com/pay/plan_abc?a=scleaderboard",
      "https://whop.com/sharpbets/monthly?a=SportsCappersLeaderboard",
      // A storefront slug that merely starts with "network" is not the hub.
      "https://whop.com/networkers/plan?a=scleaderboard",
    ]) {
      assert.equal(isWhopCreatorReferralUrl(url), false, url);
      assert.equal(isWhopCheckoutUrl(url), true, url);
      assert.deepEqual(whopAffiliateParamIssues(url, "scleaderboard"), [], url);
    }
  });

  it("still reports a missing affiliate parameter", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/some-capper/vip-plan",
      "scleaderboard",
    );
    assert.equal(issues.length, 1);
    assert.match(issues[0]!, /Missing \?a= affiliate parameter/);
  });
});
