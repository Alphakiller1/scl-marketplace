import assert from "node:assert/strict";
import test from "node:test";

import { calculateProfileCompletion } from "@/lib/profile-completion";

test("profile completion reports every missing identity signal", () => {
  const completion = calculateProfileCompletion({});

  assert.equal(completion.completed, 0);
  assert.equal(completion.percentage, 0);
  assert.equal(completion.isComplete, false);
  assert.equal(completion.items.length, 7);
});

test("profile completion reaches 100 only with all identity signals", () => {
  const completion = calculateProfileCompletion({
    displayName: "Chase Analytics",
    avatarUrl: "https://example.com/avatar.webp",
    headline: "Market-aware MLB sides and player props",
    bio: "A transparent betting process built around matchup data, market timing, price sensitivity, and disciplined bankroll management.",
    sports: ["MLB"],
    specialties: ["Player props"],
    website: "https://example.com",
  });

  assert.equal(completion.completed, 7);
  assert.equal(completion.percentage, 100);
  assert.equal(completion.isComplete, true);
});
