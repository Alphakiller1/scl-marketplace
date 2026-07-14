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

test("profile schema accepts a minimal valid profile", () => {
  assert.equal(profileSchema.safeParse(validProfile).success, true);
});

test("profile schema accepts curated sportsbooks", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      books: ["draftkings", "fanduel"],
    }).success,
    true,
  );
});

test("profile schema rejects unknown sportsbooks", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      books: ["pinnacle"],
    }).success,
    false,
  );
});

test("profile schema rejects unknown sports", () => {
  assert.equal(
    profileSchema.safeParse({
      ...validProfile,
      sports: ["Quidditch"],
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
