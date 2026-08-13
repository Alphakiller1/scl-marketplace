import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterBySlateDay,
  localDateKey,
  nearTermEvents,
  slateDayKeys,
  slateDateLabel,
  slateGroupKey,
  slateGroupLabel,
  UPCOMING_SLATE_DAYS,
} from "@/lib/slate";

test("slateDayKeys anchors today and the start of the upcoming range", () => {
  const now = new Date("2026-07-14T15:00:00");
  const keys = slateDayKeys(now);
  assert.equal(keys.today, localDateKey(now));
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  assert.equal(keys.upcoming, localDateKey(tmr));
  assert.notEqual(keys.today, keys.upcoming);
});

test("upcoming reaches past tomorrow so a capper can log a game days out", () => {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const at = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return { commenceTime: d.toISOString() };
  };

  const events = [at(0), at(1), at(5), at(UPCOMING_SLATE_DAYS)];

  assert.equal(filterBySlateDay(events, "today", now).length, 1);
  // Tomorrow, five days out, and the far edge of the horizon all qualify —
  // this is the whole point: NFL lines are posted weeks ahead.
  assert.equal(filterBySlateDay(events, "upcoming", now).length, 3);
  assert.equal(nearTermEvents(events, now).length, 4);
});

test("the horizon is a real boundary, and started games are excluded", () => {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const at = (days: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    return { commenceTime: d.toISOString() };
  };

  const beyond = at(UPCOMING_SLATE_DAYS + 2);
  assert.equal(filterBySlateDay([beyond], "upcoming", now).length, 0);
  assert.equal(nearTermEvents([beyond], now).length, 0);

  const yesterday = at(-1);
  assert.equal(nearTermEvents([yesterday], now).length, 0);

  // A malformed commence time is dropped rather than crashing the board.
  assert.equal(nearTermEvents([{ commenceTime: "not-a-date" }], now).length, 0);
});

test("upcoming events group under their own day", () => {
  const a = new Date("2026-08-14T23:05:00Z").toISOString();
  const b = new Date("2026-08-14T18:00:00Z").toISOString();
  const c = new Date("2026-08-16T20:00:00Z").toISOString();

  assert.equal(slateGroupKey(a), slateGroupKey(b));
  assert.notEqual(slateGroupKey(a), slateGroupKey(c));
  assert.ok(slateGroupLabel(a).length > 0);
});

test("slateDateLabel gives a date for today and a range for upcoming", () => {
  const now = new Date("2026-08-13T12:00:00");
  assert.ok(slateDateLabel("today", now).length > 0);
  const upcoming = slateDateLabel("upcoming", now);
  assert.ok(upcoming.includes("–"), `expected a range, got ${upcoming}`);
});
