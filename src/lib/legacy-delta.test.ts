import assert from "node:assert/strict";
import { test } from "node:test";

import { planDelta, playKey, type ExistingPlay } from "./legacy-delta";
import type { LegacyPlayInput } from "./schemas/legacy-import.schema";

const at = (iso: string) => new Date(iso);

function play(over: Partial<LegacyPlayInput> = {}): LegacyPlayInput {
  return {
    sport: "MLB",
    market: "MONEYLINE",
    selection: "Yankees ML",
    oddsAmerican: -110,
    units: 1,
    outcome: "WIN",
    createdAt: at("2026-08-01T23:05:00.000Z"),
    ...over,
  } as LegacyPlayInput;
}

function existing(over: Partial<ExistingPlay> = {}): ExistingPlay {
  return {
    id: "p1",
    sport: "MLB",
    selection: "Yankees ML",
    oddsAmerican: -110,
    createdAt: at("2026-08-01T23:05:00.000Z"),
    outcome: "WIN",
    ...over,
  };
}

test("an already-imported play is not re-inserted", () => {
  const plan = planDelta([play()], [existing()]);
  assert.equal(plan.insert.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("a genuinely new play is inserted", () => {
  const plan = planDelta(
    [play({ createdAt: at("2026-08-03T18:00:00.000Z") })],
    [existing()],
  );
  assert.equal(plan.insert.length, 1);
  assert.equal(plan.unchanged, 0);
});

test("same matchup at a different price is a different play", () => {
  // A capper legitimately logging the same side twice at different numbers.
  const plan = planDelta([play({ oddsAmerican: -125 })], [existing()]);
  assert.equal(plan.insert.length, 1);
});

test("a PENDING row is settled rather than duplicated", () => {
  // Legacy moves a pick from active_plays to MPicks when it grades, so the
  // same play arrives a second time carrying a result.
  const plan = planDelta(
    [play({ outcome: "LOSS" })],
    [existing({ outcome: "PENDING" })],
  );
  assert.equal(plan.insert.length, 0);
  assert.equal(plan.settle.length, 1);
  assert.equal(plan.settle[0].id, "p1");
  assert.equal(plan.settle[0].play.outcome, "LOSS");
});

test("a still-pending play stays untouched", () => {
  const plan = planDelta(
    [play({ outcome: "PENDING" })],
    [existing({ outcome: "PENDING" })],
  );
  assert.equal(plan.insert.length, 0);
  assert.equal(plan.settle.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("duplicates inside one export file collapse to a single insert", () => {
  const plan = planDelta([play(), play()], []);
  assert.equal(plan.insert.length, 1);
});

test("selection whitespace and case differences still match", () => {
  // MPicks and past_plays format the same pick slightly differently.
  const plan = planDelta(
    [play({ selection: "  Yankees   ML " })],
    [existing()],
  );
  assert.equal(plan.insert.length, 0);
  assert.equal(plan.unchanged, 1);
});

test("falls back to gradedAt when createdAt is absent", () => {
  const plan = planDelta(
    [play({ createdAt: undefined, gradedAt: at("2026-08-01T23:05:00.000Z") })],
    [existing()],
  );
  assert.equal(plan.insert.length, 0);
});

test("an empty database imports everything", () => {
  const plan = planDelta([play(), play({ oddsAmerican: 150 })], []);
  assert.equal(plan.insert.length, 2);
});

test("playKey is stable across equal Date instances", () => {
  assert.equal(
    playKey({
      sport: "NBA",
      selection: "Lakers -3",
      oddsAmerican: -110,
      createdAt: at("2026-08-01T00:00:00.000Z"),
    }),
    playKey({
      sport: "NBA",
      selection: "Lakers -3",
      oddsAmerican: -110,
      createdAt: at("2026-08-01T00:00:00.000Z"),
    }),
  );
});
