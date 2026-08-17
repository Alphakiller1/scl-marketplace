import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatPriceCents,
  packageCtaLabel,
  pendingStatusForProvider,
  providerLabel,
  selectInitialStoreConnection,
  storeStatusLabel,
  storeStatusTone,
} from "@/lib/store-connection";

describe("store-connection helpers", () => {
  it("maps pending status by provider", () => {
    assert.equal(pendingStatusForProvider("WINIBLE"), "PENDING_SCL_ACCEPTANCE");
    assert.equal(pendingStatusForProvider("WHOP"), "PENDING_SCL_LINK_IMPORT");
  });

  it("never treats pending as live tone", () => {
    assert.equal(storeStatusTone("PENDING_SCL_ACCEPTANCE"), "pending");
    assert.equal(storeStatusTone("PENDING_SCL_LINK_IMPORT"), "pending");
    assert.equal(storeStatusTone("LIVE"), "live");
  });

  it("labels providers", () => {
    assert.equal(providerLabel("WINIBLE"), "Winible");
    assert.equal(providerLabel("WHOP"), "Whop");
  });

  it("maps provider workflow states to owner-facing labels", () => {
    assert.equal(
      storeStatusLabel("PENDING_SCL_ACCEPTANCE"),
      "Awaiting SCL Acceptance",
    );
    assert.equal(
      storeStatusLabel("PENDING_SCL_LINK_IMPORT"),
      "Pending SCL Review",
    );
    assert.equal(
      storeStatusLabel("LINKS_RECEIVED"),
      "Approved · Links Received",
    );
    assert.equal(storeStatusLabel("LIVE"), "Storefront Live");
    assert.equal(storeStatusLabel("NEEDS_ACTION"), "Needs Attention");
    assert.equal(storeStatusLabel("DISABLED"), "Suspended");
  });

  it("resumes unfinished Whop setup before a reviewed Winible connection", () => {
    const selected = selectInitialStoreConnection([
      { id: "winible", status: "LINKS_RECEIVED" as const },
      { id: "whop", status: "INSTRUCTIONS_VIEWED" as const },
    ]);

    assert.equal(selected?.id, "whop");
  });

  it("resumes a not-started connection before a live connection", () => {
    const selected = selectInitialStoreConnection([
      { id: "live", status: "LIVE" as const },
      { id: "new", status: "NOT_STARTED" as const },
    ]);

    assert.equal(selected?.id, "new");
  });

  it("keeps the existing reviewed connection priority when setup is complete", () => {
    const selected = selectInitialStoreConnection([
      { id: "reviewed", status: "PACKAGES_IMPORTED" as const },
      { id: "disabled", status: "DISABLED" as const },
    ]);

    assert.equal(selected?.id, "reviewed");
  });

  it("adapts purchase CTA by platform", () => {
    assert.equal(packageCtaLabel("WHOP"), "Subscribe on Whop");
    assert.equal(packageCtaLabel("WINIBLE"), "Subscribe on Winible");
    assert.equal(packageCtaLabel(null), "Subscribe");
  });

  it("formats display prices", () => {
    assert.equal(formatPriceCents(9900, "MONTH"), "$99 / month");
    // Zero is a price, not a missing one — and carries no cadence, because a
    // free trial's stored billingPeriod is frequently wrong and was invisible
    // for as long as the price was hidden.
    assert.equal(formatPriceCents(0, "MONTH"), "Free");
    assert.equal(formatPriceCents(0, "DAY"), "Free");
    // Only a nonsense price has nothing to show.
    assert.equal(formatPriceCents(-1, "MONTH"), null);
    assert.equal(formatPriceCents(Number.NaN, "MONTH"), null);
  });
});
