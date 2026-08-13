import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { billingTermLabel, formatPriceCents } from "@/lib/store-connection";
import { adminPackageSchema } from "@/lib/schemas/store.schema";
import { whopAffiliateUsername } from "@/lib/whop-config";

describe("billingTermLabel", () => {
  it("keeps a single period in the short singular form", () => {
    assert.equal(billingTermLabel("DAY", 1), "day");
    assert.equal(billingTermLabel("WEEK", 1), "week");
    assert.equal(billingTermLabel("MONTH", 1), "month");
    assert.equal(billingTermLabel("YEAR", 1), "year");
  });

  // The whole point of the change: 4 and 5 day terms were unreachable because
  // the cadence was a bare unit with no count.
  it("pluralizes a multi-period term", () => {
    assert.equal(billingTermLabel("DAY", 4), "4 days");
    assert.equal(billingTermLabel("DAY", 5), "5 days");
    assert.equal(billingTermLabel("WEEK", 2), "2 weeks");
    assert.equal(billingTermLabel("MONTH", 3), "3 months");
    assert.equal(billingTermLabel("YEAR", 2), "2 years");
  });

  it("has no term for a one-time package", () => {
    assert.equal(billingTermLabel("ONE_TIME", 1), "");
    assert.equal(billingTermLabel("ONE_TIME", 4), "");
  });

  it("ignores a count on a season", () => {
    assert.equal(billingTermLabel("SEASON", 1), "season");
    assert.equal(billingTermLabel("SEASON", 3), "season");
  });

  // The label is public, so a bad stored value must not render as one.
  it("never renders a zero or negative term", () => {
    assert.equal(billingTermLabel("DAY", 0), "day");
    assert.equal(billingTermLabel("DAY", -3), "day");
    assert.equal(billingTermLabel("DAY", 2.7), "2 days");
  });

  it("defaults to a single period when no count is given", () => {
    assert.equal(billingTermLabel("WEEK"), "week");
  });
});

describe("formatPriceCents", () => {
  it("reads a multi-day term the way a customer would", () => {
    assert.equal(formatPriceCents(2299, "WEEK", 1), "$22.99 / week");
    assert.equal(formatPriceCents(1500, "DAY", 4), "$15 / 4 days");
    assert.equal(formatPriceCents(999, "DAY", 5), "$9.99 / 5 days");
  });

  it("drops the term for a one-time price", () => {
    assert.equal(formatPriceCents(4999, "ONE_TIME", 1), "$49.99");
  });

  it("says Free rather than falling through to the provider", () => {
    // A $0 package used to render "See provider for current price", so setting
    // a price to zero looked like it had not saved. No cadence: these are
    // trials whose stored billingPeriod is often wrong, and it was invisible
    // while the price was hidden.
    assert.equal(formatPriceCents(0, "MONTH", 1), "Free");
    assert.equal(formatPriceCents(0, "DAY", 3), "Free");
  });

  // Existing rows default to 1, so every package that predates the count reads
  // exactly as it did before.
  it("is unchanged for a package with no explicit count", () => {
    assert.equal(formatPriceCents(3999, "MONTH"), "$39.99 / month");
  });
});

describe("adminPackageSchema billing interval", () => {
  // The affiliate username is validated against config, so read it from there
  // rather than hardcoding — a literal here silently fails every case in this
  // block for a reason that has nothing to do with billing terms.
  const base = {
    capperId: "cap1",
    affiliateProvider: "WHOP" as const,
    title: "S-Tier Plays",
    checkoutUrl: `https://whop.com/checkout/abc?a=${whopAffiliateUsername()}`,
    priceCents: 1500,
  };

  it("accepts a 4-day term", () => {
    const parsed = adminPackageSchema.safeParse({
      ...base,
      billingPeriod: "DAY",
      billingIntervalCount: 4,
    });
    assert.equal(parsed.success, true);
  });

  it("defaults to one period", () => {
    const parsed = adminPackageSchema.safeParse({
      ...base,
      billingPeriod: "MONTH",
    });
    assert.equal(parsed.success, true);
    if (parsed.success) assert.equal(parsed.data.billingIntervalCount, 1);
  });

  it("rejects a count on a one-time or season package", () => {
    for (const billingPeriod of ["ONE_TIME", "SEASON"] as const) {
      const parsed = adminPackageSchema.safeParse({
        ...base,
        billingPeriod,
        billingIntervalCount: 3,
      });
      assert.equal(parsed.success, false, billingPeriod);
    }
  });

  it("rejects a zero, fractional, or absurd term", () => {
    for (const billingIntervalCount of [0, -1, 2.5, 400]) {
      const parsed = adminPackageSchema.safeParse({
        ...base,
        billingPeriod: "DAY",
        billingIntervalCount,
      });
      assert.equal(parsed.success, false, String(billingIntervalCount));
    }
  });
});
