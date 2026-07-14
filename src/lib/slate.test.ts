import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterBySlateDay,
  localDateKey,
  nearTermEvents,
  slateDayKeys,
  slateDateLabel,
} from "@/lib/slate";

test("slateDayKeys returns distinct today and tomorrow local keys", () => {
  const now = new Date("2026-07-14T15:00:00");
  const keys = slateDayKeys(now);
  assert.equal(keys.today, localDateKey(now));
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  assert.equal(keys.tomorrow, localDateKey(tmr));
  assert.notEqual(keys.today, keys.tomorrow);
});

test("filterBySlateDay / nearTermEvents use local calendar days", () => {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  const todayIso = new Date(now).toISOString();
  const tmr = new Date(now);
  tmr.setDate(tmr.getDate() + 1);
  const events = [
    { commenceTime: todayIso },
    { commenceTime: tmr.toISOString() },
    {
      commenceTime: new Date(now.getTime() + 5 * 86400000).toISOString(),
    },
  ];
  assert.equal(filterBySlateDay(events, "today", now).length, 1);
  assert.equal(filterBySlateDay(events, "tomorrow", now).length, 1);
  assert.equal(nearTermEvents(events, now).length, 2);
});

test("slateDateLabel is non-empty for today and tomorrow", () => {
  assert.ok(slateDateLabel("today").length > 0);
  assert.ok(slateDateLabel("tomorrow").length > 0);
});
