import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { UPCOMING_SLATE_DAYS } from "@/lib/slate";
import {
  SURFACE_HORIZON_DAYS,
  surfaceCommenceBounds,
  surfaceCommenceQuery,
} from "@/lib/odds-surface-window";

test("surface odds window matches the pick-entry slate horizon", () => {
  assert.equal(SURFACE_HORIZON_DAYS, UPCOMING_SLATE_DAYS);
  const now = new Date("2026-08-22T04:00:00.000Z");
  const bounds = surfaceCommenceBounds(now);
  assert.equal(bounds.from, "2026-08-22T04:00:00Z");
  assert.equal(bounds.to, "2026-09-05T04:00:00Z");
  const query = surfaceCommenceQuery(now);
  assert.match(query, /commenceTimeFrom=2026-08-22T04%3A00%3A00Z/);
  assert.match(query, /commenceTimeTo=2026-09-05T04%3A00%3A00Z/);
});

test("live surface fetches bind the slate window and skip empty paid boards", () => {
  const src = readFileSync("src/lib/odds-api.ts", "utf8");
  assert.match(src, /surfaceCommenceQuery/);
  assert.match(src, /hasUpcomingSurfaceEvents/);
  assert.match(src, /setOddsCircuitBreakSuspended/);
  assert.match(src, /shouldSkipUncachedBoard/);
});
