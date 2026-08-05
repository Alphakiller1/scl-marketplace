import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  adminActionSuccessMessage,
  adminApproveLabel,
  adminStorefrontReadiness,
  packagePublicationLabel,
  storefrontGoLiveGate,
} from "@/lib/storefront-ops";

describe("storefront ops helpers", () => {
  it("uses provider-aware approve labels", () => {
    assert.equal(adminApproveLabel("WINIBLE"), "Confirm affiliate accepted");
    assert.equal(adminApproveLabel("WHOP"), "Confirm affiliate ready");
  });

  it("blocks Mark live until affiliate confirmed and packages activated", () => {
    assert.deepEqual(
      storefrontGoLiveGate({
        status: "PENDING_SCL_ACCEPTANCE",
        activePackageCount: 2,
      }).canMarkLive,
      false,
    );
    assert.deepEqual(
      storefrontGoLiveGate({
        status: "PACKAGES_IMPORTED",
        activePackageCount: 0,
      }).canMarkLive,
      false,
    );
    assert.equal(
      storefrontGoLiveGate({
        status: "PACKAGES_IMPORTED",
        activePackageCount: 1,
      }).canMarkLive,
      true,
    );
  });

  it("computes readiness for both providers", () => {
    const winible = adminStorefrontReadiness({
      provider: "WINIBLE",
      status: "PENDING_SCL_ACCEPTANCE",
      packageCount: 0,
      activePackageCount: 0,
      affiliatePercent: null,
      whopConnected: false,
    });
    assert.equal(winible[0]?.done, true);
    assert.equal(winible.at(-1)?.done, false);

    const whop = adminStorefrontReadiness({
      provider: "WHOP",
      status: "LIVE",
      packageCount: 2,
      activePackageCount: 1,
      affiliatePercent: 35,
      whopConnected: true,
    });
    assert.ok(whop.every((item) => item.done));
  });

  it("distinguishes package draft / ready / public states", () => {
    assert.equal(
      packagePublicationLabel({
        isActive: false,
        hasCheckout: true,
        connectionStatus: "LIVE",
        unattached: false,
      }).label,
      "Draft",
    );
    assert.equal(
      packagePublicationLabel({
        isActive: true,
        hasCheckout: true,
        connectionStatus: "PACKAGES_IMPORTED",
        unattached: false,
      }).label,
      "Ready · not live",
    );
    assert.equal(
      packagePublicationLabel({
        isActive: true,
        hasCheckout: true,
        connectionStatus: "LIVE",
        unattached: false,
      }).label,
      "Public",
    );
  });

  it("returns clear success copy for Mark live", () => {
    assert.match(adminActionSuccessMessage("MARK_LIVE", "WINIBLE"), /live/i);
  });
});
