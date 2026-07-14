import assert from "node:assert/strict";
import test from "node:test";

import { profileSchema } from "@/lib/schemas/profile.schema";

const validProfile = {
  providerType: "FREE" as const,
  sports: ["MLB"],
  specialties: ["Player props"],
  betTypes: ["PROP"] as const,
  writtenAnalysis: true,
  storefrontEnabled: true,
};

test("profile links allow public web URLs and social handles", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      twitter: "@chase_analytics",
      website: "https://example.com/profile",
    }).success,
    true,
  );
});

test("profile links reject executable URLs and full social URLs", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      website: "javascript:alert(1)",
    }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      twitter: "https://x.com/chase",
    }).success,
    false,
  );
});

test("profile storefront copy follows its length contract", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      storefrontTitle: "Weekly MLB card",
      storefrontDescription: "Sides, totals, and props selected by the capper.",
    }).success,
    true,
  );
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      storefrontTitle: "x".repeat(81),
    }).success,
    false,
  );
});
