import assert from "node:assert/strict";
import { test } from "node:test";

import { formatUpdatedAgo } from "@/lib/format-freshness";

test("formatUpdatedAgo uses just now under one minute", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(formatUpdatedAgo(now, now), "Updated Just Now");
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 30_000), now),
    "Updated Just Now",
  );
});

test("formatUpdatedAgo formats minutes and hours", () => {
  const now = new Date("2026-07-18T12:00:00.000Z");
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 60_000), now),
    "Updated 1m Ago",
  );
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 12 * 60_000), now),
    "Updated 12m Ago",
  );
  assert.equal(
    formatUpdatedAgo(new Date(now.getTime() - 2 * 60 * 60_000), now),
    "Updated 2h Ago",
  );
});
