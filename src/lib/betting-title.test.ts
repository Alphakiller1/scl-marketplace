import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitBettingTitle } from "@/lib/betting-title";

describe("splitBettingTitle", () => {
  it("splits totals", () => {
    assert.deepEqual(splitBettingTitle("Over 170.5"), [
      { kind: "text", value: "Over " },
      { kind: "num", value: "170.5" },
    ]);
  });

  it("splits signed spreads", () => {
    assert.deepEqual(splitBettingTitle("Lakers -4.5"), [
      { kind: "text", value: "Lakers " },
      { kind: "num", value: "-4.5" },
    ]);
  });

  it("splits American odds", () => {
    assert.deepEqual(splitBettingTitle("Yankees ML +150"), [
      { kind: "text", value: "Yankees ML " },
      { kind: "num", value: "+150" },
    ]);
  });

  it("splits leg counts", () => {
    assert.deepEqual(splitBettingTitle("2-Leg Parlay"), [
      { kind: "num", value: "2" },
      { kind: "text", value: "-Leg Parlay" },
    ]);
  });

  it("passes through titles without numbers", () => {
    assert.deepEqual(splitBettingTitle("Dodgers ML"), [
      { kind: "text", value: "Dodgers ML" },
    ]);
  });
});
