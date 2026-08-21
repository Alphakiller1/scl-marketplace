import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  isPackagePubliclyPublishable,
  packageUnpublishableReason,
  packageUnpublishableMessage,
} from "@/lib/public-packages";

test("manual unattached packages publish when active with checkout + tracking", () => {
  assert.equal(
    isPackagePubliclyPublishable({
      isActive: true,
      checkoutUrl: "https://whop.com/checkout/plan_abc?a=scleaderboard",
      hasTrackingUrl: true,
      storeConnectionId: null,
    }),
    true,
  );
});

test("packages on a pending storefront do not publish until Mark live", () => {
  assert.equal(
    isPackagePubliclyPublishable({
      isActive: true,
      checkoutUrl: "https://whop.com/checkout/plan_abc?a=scleaderboard",
      hasTrackingUrl: true,
      storeConnectionId: "conn_1",
      storeConnectionStatus: "PENDING_SCL_LINK_IMPORT",
    }),
    false,
  );
});

test("packages awaiting Mark live are not mislabeled as missing links", () => {
  assert.equal(
    packageUnpublishableReason({
      isActive: true,
      checkoutUrl: "https://whop.com/checkout/plan_abc?a=scleaderboard",
      hasTrackingUrl: true,
      storeConnectionId: "conn_1",
      storeConnectionStatus: "PACKAGES_IMPORTED",
    }),
    "awaiting_mark_live",
  );
  assert.match(
    packageUnpublishableMessage("awaiting_mark_live"),
    /already has a checkout link saved/i,
  );
});

test("store action keeps manual packages unattached when no connection is sent", () => {
  const source = readFileSync("src/lib/actions/store.action.ts", "utf8");
  assert.doesNotMatch(
    source,
    /capperId_provider:[\s\S]*storeConnectionId = conn\?\.id/,
  );
});
