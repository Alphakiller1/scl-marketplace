import assert from "node:assert/strict";
import { test } from "node:test";
import { buildGradingWorkQueue } from "@/lib/results/grading-work-queue";
import type { StuckPlayRow } from "@/lib/results/stuck-plays";

const row = (id: number): StuckPlayRow => ({
  id: String(id),
  handle: id > 50 ? "last-capper" : "first-capper",
  sport: "NCAAB",
  market: "Spread",
  selection: "Gonzaga Bulldogs -7",
  oddsAmerican: -110,
  units: 1,
  eventId: null,
  eventStartsAt: null,
  parlayId: null,
});

test("every overdue play remains accessible beyond both the old 50 and 1000 limits", () => {
  const plays = Array.from({ length: 1_205 }, (_, i) => row(i));
  const queue = buildGradingWorkQueue([], plays, [
    { ...row(1_205), parlayId: "ticket" },
  ]);
  assert.equal(queue.length, 1_206);
  assert.equal(queue.at(-1)?.parlayId, "ticket");
  assert.equal(queue.find((p) => p.id === "75")?.handle, "last-capper");
});

test("manual reasons win on duplicates and explicit bounded callers still work", () => {
  const manual = { ...row(1), reason: "Unsupported market" };
  const queue = buildGradingWorkQueue(
    [manual],
    [row(1), row(2)],
    [row(2), row(3)],
  );
  assert.deepEqual(
    queue.map((p) => p.id),
    ["1", "2", "3"],
  );
  assert.equal(queue[0].reason, manual.reason);
  assert.equal(queue[0].manualOnly, true);
  assert.equal(buildGradingWorkQueue([manual], [row(2)], [], 1).length, 1);
});
