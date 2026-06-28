import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultStorefrontTitle,
  resolveStorefrontIdentity,
} from "@/lib/storefront";

test("default storefront follows the capper identity until customized", () => {
  assert.equal(
    defaultStorefrontTitle("Chase Analytics"),
    "Chase Analytics' Storefront",
  );

  assert.deepEqual(
    resolveStorefrontIdentity({
      displayName: "Chase Analytics",
      username: "chase",
    }),
    {
      title: "Chase Analytics' Storefront",
      description:
        "Picks and packages selected by Chase Analytics will appear here when they are live.",
      enabled: true,
      customized: false,
    },
  );
});

test("custom storefront copy is trimmed and visibility is preserved", () => {
  assert.deepEqual(
    resolveStorefrontIdentity({
      displayName: "Capper",
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
