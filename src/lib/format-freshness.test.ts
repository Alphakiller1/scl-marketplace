import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUpdatedAgo } from "@/lib/format-freshness";

test("formatUpdatedAgo uses just now under one minute", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(formatUpdatedAgo(now, now), "Updated just now");
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 30_000), now),
    "Updated just now",
  );
});

test("formatUpdatedAgo formats minutes and hours", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 60_000), now),
    "Updated 1m ago",
  );
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 12 * 60_000), now),
    "Updated 12m ago",
  );
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 2 * 60 * 60_000), now),
    "Updated 2h ago",
  );
});
