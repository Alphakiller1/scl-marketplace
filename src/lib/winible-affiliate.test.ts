import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { WINIBLE_CAPPER_REFERRAL_URL } from "@/lib/store-connection";
import {
  isWinibleCheckoutUrl,
  winibleCheckoutUrlIssues,
} from "@/lib/winible-affiliate";

describe("winible checkout URL validation", () => {
  it("accepts legacy-style checkout links", () => {
    assert.equal(
      isWinibleCheckoutUrl(
        "https://www.winible.com/checkout/1487557995624682249",
      ),
      true,
    );
    assert.equal(
      isWinibleCheckoutUrl("https://winible.com/capper/premium-package"),
      true,
    );
  });

  it("rejects the SCL creator onboarding referral", () => {
    assert.equal(isWinibleCheckoutUrl(WINIBLE_CAPPER_REFERRAL_URL), false);
    const issues = winibleCheckoutUrlIssues(WINIBLE_CAPPER_REFERRAL_URL);
    assert.match(issues[0] || "", /creator-onboarding referral/);
  });

  it("rejects non-Winible hosts", () => {
    assert.equal(isWinibleCheckoutUrl("https://whop.com/x"), false);
  });

  it("flags HTML-escaped query parameters", () => {
    const issues = winibleCheckoutUrlIssues(
      "https://winible.com/checkout/123?amp;ref=abc",
    );
    assert.match(issues[0] || "", /HTML-escaped/);
  });

  it("passes a valid package link", () => {
    assert.deepEqual(
      winibleCheckoutUrlIssues(
        "https://winible.com/checkout/1487557995624682249",
      ),
      [],
    );
  });
});
