import assert from "node:assert/strict";
import test from "node:test";

import { deriveStorefrontStatus } from "@/lib/commerce";

test("deriveStorefrontStatus keeps needs attention pinned", () => {
  assert.equal(
    deriveStorefrontStatus({
      current: "NEEDS_ATTENTION",
      livePackageCount: 3,
    }),
    "NEEDS_ATTENTION",
  );
});
