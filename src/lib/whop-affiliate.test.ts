import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isWhopCheckoutUrl,
  whopAffiliateParamIssues,
} from "@/lib/whop-affiliate";

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
      "sportscappersleaderboard",
    );
    assert.match(issues[0] || "", /expects "sportscappersleaderboard"/);
  });

  it("passes a valid affiliate link", () => {
    const issues = whopAffiliateParamIssues(
      "https://whop.com/x?a=sportscappersleaderboard",
      "sportscappersleaderboard",
    );
    assert.deepEqual(issues, []);
  });
});
