import assert from "node:assert/strict";
import test from "node:test";

import {
  activePublicPackageWhere,
  publicPackagePublicationWhere,
} from "@/lib/public-packages";

test("public package predicate gates offer, storefront, tracking, and account", () => {
  const publication = { isTest: false };
  const where = publicPackagePublicationWhere(publication);

  assert.equal(where.isActive, true);
  assert.deepEqual(where.checkoutUrl, { not: null });
  assert.deepEqual(where.trackingUrls, { some: {} });
  assert.deepEqual(where.OR, activePublicPackageWhere.OR);

  const user = where.capper as {
    user: { AND: unknown[] };
  };
  assert.deepEqual(user.user.AND[0], {
    username: { not: null },
    accountStatus: "ACTIVE",
  });
  assert.deepEqual(user.user.AND[1], publication);
});
