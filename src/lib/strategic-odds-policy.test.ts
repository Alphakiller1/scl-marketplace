import assert from "node:assert/strict";
import test from "node:test";
import {
  dueRefreshSlots,
  STRATEGIC_ODDS_COMPETITIONS,
} from "./strategic-odds-policy";

const competition = (id: string) =>
  STRATEGIC_ODDS_COMPETITIONS.find((row) => row.id === id)!;

test("MLB refresh becomes due two hours before first game", () => {
  const due = dueRefreshSlots(
    competition("mlb"),
    [new Date("2026-08-12T23:00:00Z")],
    new Set(),
    new Date("2026-08-12T21:00:00Z"),
  );
  assert.ok(
    due.includes("mlb:08/12/2026:pre-first") ||
      due.some((key) => key.endsWith(":pre-first")),
  );
});

test("tomorrow NFL pregame slot is not spent today", () => {
  const due = dueRefreshSlots(
    competition("nfl-preseason"),
    [new Date("2026-08-13T23:00:00Z")],
    new Set(),
    new Date("2026-08-12T16:00:00Z"),
  );
  assert.equal(
    due.some((key) => key.endsWith(":pre-first")),
    false,
  );
  assert.equal(
    due.some((key) => key.endsWith(":daily")),
    true,
  );
});

test("completed slots are not billed twice", () => {
  const first = dueRefreshSlots(
    competition("wnba"),
    [],
    new Set(),
    new Date("2026-08-12T13:00:00Z"),
  );
  assert.equal(first.length, 1);
  assert.deepEqual(
    dueRefreshSlots(
      competition("wnba"),
      [],
      new Set(first),
      new Date("2026-08-12T13:15:00Z"),
    ),
    [],
  );
});
