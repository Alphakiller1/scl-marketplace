import assert from "node:assert/strict";
import test from "node:test";

import {
  activePublicPackageWhere,
  PLACEHOLDER_CHECKOUT_HOSTS,
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

test("a placeholder checkout host is never sellable", () => {
  // One `example.com` offer was live on the public marketplace. A placeholder
  // checkout is worse than a missing package: it takes a real click and lands
  // on nothing, so it is excluded at the predicate rather than by remembering
  // to clean up after every seeder and importer.
  const exclusions = activePublicPackageWhere.AND;
  assert.equal(exclusions.length, PLACEHOLDER_CHECKOUT_HOSTS.length);

  for (const host of PLACEHOLDER_CHECKOUT_HOSTS) {
    assert.ok(
      exclusions.some(
        (clause) =>
          typeof clause.checkoutUrl === "object" &&
          clause.checkoutUrl !== null &&
          "not" in clause.checkoutUrl &&
          typeof clause.checkoutUrl.not === "object" &&
          clause.checkoutUrl.not !== null &&
          "contains" in clause.checkoutUrl.not &&
          clause.checkoutUrl.not.contains === host,
      ),
      `expected ${host} to be excluded`,
    );
  }

  // The exclusion has to survive the public predicate too, not just the base.
  assert.deepEqual(
    publicPackagePublicationWhere({ isTest: false }).AND,
    exclusions,
  );
});
