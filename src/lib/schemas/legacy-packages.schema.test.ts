import assert from "node:assert/strict";
import { test } from "node:test";

import {
  legacyPackageSlug,
  legacyPackagesImportSchema,
} from "@/lib/schemas/legacy-packages.schema";

const pkg = (over: Record<string, unknown> = {}) => ({
  username: "wgs",
  legacyRef: "AFFV9879U39",
  title: "Play of the Day",
  description: "Our top play each day.",
  priceCents: 2500,
  billingPeriod: "WEEK",
  checkoutUrl: "https://www.winible.com/checkout/1487557995624682249",
  affiliateProvider: "WINIBLE",
  sortOrder: 1,
  isActive: true,
  ...over,
});

test("accepts a well-formed carried-over package", () => {
  const parsed = legacyPackagesImportSchema.safeParse([pkg()]);
  assert.equal(parsed.success, true);
});

test("requires a checkout URL — an offer without one can never publish", () => {
  assert.equal(
    legacyPackagesImportSchema.safeParse([pkg({ checkoutUrl: "" })]).success,
    false,
  );
  assert.equal(
    legacyPackagesImportSchema.safeParse([pkg({ checkoutUrl: "not-a-url" })])
      .success,
    false,
  );
});

test("allows a zero price — it renders no price label rather than 'free'", () => {
  // The legacy copy sometimes quotes several figures; publishing 0 keeps the
  // checkout page authoritative instead of showing the wrong one.
  assert.equal(
    legacyPackagesImportSchema.safeParse([pkg({ priceCents: 0 })]).success,
    true,
  );
  assert.equal(
    legacyPackagesImportSchema.safeParse([pkg({ priceCents: -1 })]).success,
    false,
  );
});

test("rejects a duplicate legacyRef — it keys the tracking slug", () => {
  const parsed = legacyPackagesImportSchema.safeParse([
    pkg(),
    pkg({ title: "Another" }),
  ]);
  assert.equal(parsed.success, false);
});

test("allows one capper to hold several distinct offers", () => {
  const parsed = legacyPackagesImportSchema.safeParse([
    pkg(),
    pkg({ legacyRef: "AFFF6057T51", title: "Parlay Package", sortOrder: 2 }),
  ]);
  assert.equal(parsed.success, true);
});

test("the tracking slug is deterministic, url-safe and bounded", () => {
  const a = legacyPackageSlug("wgs", "AFFV9879U39");
  assert.equal(a, legacyPackageSlug("wgs", "AFFV9879U39"));
  assert.equal(a, "wgs-affv9879u39");
  assert.match(a, /^[a-z0-9-]+$/);
  assert.ok(legacyPackageSlug("a".repeat(40), "b".repeat(40)).length <= 64);
});

test("different offers never collide on a slug", () => {
  assert.notEqual(
    legacyPackageSlug("wgs", "AFFV9879U39"),
    legacyPackageSlug("wgs", "AFFF6057T51"),
  );
});
