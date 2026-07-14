import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultStorefrontTitle,
  resolveStorefrontIdentity,
} from "@/lib/storefront";

test("default storefront follows the @username identity until customized", () => {
  assert.equal(defaultStorefrontTitle("@chase"), "@chase's Storefront");

  assert.deepEqual(
    resolveStorefrontIdentity({
      displayName: "Chase Analytics",
      username: "chase",
    }),
    {
      title: "@chase's Storefront",
      description:
        "Picks and packages selected by @chase will appear here when they are live.",
      enabled: true,
      customized: false,
    },
  );
});

test("custom storefront copy is trimmed and visibility is preserved", () => {
  assert.deepEqual(
    resolveStorefrontIdentity({
      username: "capper",
      title: "  Market Board  ",
      description: "  Daily and weekly packages.  ",
      enabled: false,
    }),
    {
      title: "Market Board",
      description: "Daily and weekly packages.",
      enabled: false,
      customized: true,
    },
  );
});
