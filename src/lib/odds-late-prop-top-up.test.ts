import assert from "node:assert/strict";
import test from "node:test";

import {
  LATE_PROP_TOP_UP_SPORTS,
  latePropTopUpAt,
  TOPUP_LAST_CALL_HOURS,
} from "@/lib/odds-event-buy-budget";
import type { OddsSelection } from "@/lib/odds-board";
import { addMissingEventBoardSelections } from "@/lib/odds-event-board-contract";

// 2026-10-19 MNF: 8:15 PM ET kickoff.
const KICKOFF = "2026-10-20T00:15:00Z";
const kickoffMs = Date.parse(KICKOFF);
const windowStart = kickoffMs - TOPUP_LAST_CALL_HOURS * 3_600_000;

test("NFL is opted into the late prop top-up", () => {
  assert.ok(LATE_PROP_TOP_UP_SPORTS.has("NFL"));
  assert.ok(!LATE_PROP_TOP_UP_SPORTS.has("MLB"));
});

test("late prop top-up waits for the last-call window", () => {
  const morning = Date.parse("2026-10-19T15:30:00Z");
  assert.equal(latePropTopUpAt([], morning, KICKOFF), windowStart);
});

test("late prop top-up is due once inside the window", () => {
  const inWindow = windowStart + 30 * 60_000;
  assert.equal(latePropTopUpAt([], inWindow, KICKOFF), inWindow);
  assert.equal(
    latePropTopUpAt([inWindow], inWindow + 60_000, KICKOFF),
    null,
    "already asked inside the window",
  );
});

test("an ask before the window does not count against it", () => {
  const inWindow = windowStart + 60_000;
  const earlier = windowStart - 60 * 60_000;
  assert.equal(latePropTopUpAt([earlier], inWindow, KICKOFF), inWindow);
});

test("no late prop top-up after kickoff or without a kickoff", () => {
  assert.equal(latePropTopUpAt([], kickoffMs + 1, KICKOFF), null);
  assert.equal(latePropTopUpAt([], windowStart, null), null);
});

function receptions(
  player: string,
  line: number,
  price: number,
): OddsSelection {
  const text = `${player} Over ${line}`;
  return {
    label: text,
    market: "Receptions",
    selection: text,
    side: "Over",
    line,
    player,
    oddsAmerican: price,
    book: "draftkings",
    bookPrices: { draftkings: price },
  };
}

test("a late prop ask adds the missing player without repricing the board", () => {
  const cached = [receptions("Terry McLaurin", 4.5, -120)];
  const fresh = [
    receptions("Terry McLaurin", 4.5, +105),
    receptions("Austin Ekeler", 2.5, -140),
  ];
  const rows = addMissingEventBoardSelections(cached, fresh);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]!.oddsAmerican, -120);
  assert.equal(rows[1]!.player, "Austin Ekeler");
});
