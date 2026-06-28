import assert from "node:assert/strict";
import test from "node:test";

import { profileSchema } from "@/lib/schemas/profile.schema";

const validProfile = {
  displayName: "Chase Analytics",
  providerType: "FREE" as const,
  sports: ["MLB"],
  specialties: ["Player props"],
  betTypes: ["PROP"] as const,
  writtenAnalysis: true,
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
