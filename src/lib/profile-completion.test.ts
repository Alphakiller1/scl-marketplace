import assert from "node:assert/strict";
import test from "node:test";

import { calculateProfileCompletion } from "@/lib/profile-completion";

test("profile completion ignores displayName and external links", () => {
  const completion = calculateProfileCompletion({
    displayName: "Chase Analytics",
    website: "https://example.com",
    twitter: "@chase",
  });

  assert.equal(completion.completed, 0);
  assert.equal(completion.percentage, 0);
  assert.equal(completion.isComplete, false);
  assert.equal(completion.items.length, 7);
  assert.deepEqual(
    completion.items.map((i) => i.id),
    ["photo", "cover", "headline", "bio", "sports", "specialties", "approach"],
  );
});

test("profile completion reaches 100 only with collectable fields", () => {
  const completion = calculateProfileCompletion({
    displayName: "ignored",
    website: "https://example.com",
    avatarUrl: "https://example.com/avatar.webp",
    bannerUrl: "https://example.com/banner.webp",
    headline: "Market-aware MLB sides and player props",
    bio: "A transparent betting process built around matchup data, market timing, price sensitivity, and disciplined bankroll management.",
    sports: ["MLB"],
    specialties: ["Player props"],
    providerType: "FREE",
    betTypes: ["PROP"],
    dailyVolume: "MODERATE",
  });

  assert.equal(completion.completed, 7);
  assert.equal(completion.percentage, 100);
  assert.equal(completion.isComplete, true);
});

test("approach completes with provider + bet types (volume optional)", () => {
  const completion = calculateProfileCompletion({
    providerType: "HYBRID",
    betTypes: ["STRAIGHT"],
  });
  const approach = completion.items.find((i) => i.id === "approach");
  assert.equal(approach?.complete, true);
});
