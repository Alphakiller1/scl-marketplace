import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBulkSinglesReceipt,
  shapeBulkSinglesOutcome,
  type BulkLinePrep,
} from "@/lib/bulk-plays";
import type { MovedLinePayload } from "@/lib/odds-movement";
import type { StraightReceipt } from "@/lib/verification";

function moved(
  key: string,
  cls: MovedLinePayload["class"] = "changed",
): MovedLinePayload {
  return {
    moveKey: key,
    class: cls,
    selectedOddsAmerican: -110,
    updatedOddsAmerican: cls === "unavailable" ? null : -125,
    eventId: "evt",
    eventLabel: "Away @ Home",
    market: "Moneyline",
    selection: key,
    side: "Away",
    book: "fanduel",
    verifiedAt: new Date("2026-07-14T12:00:00.000Z").toISOString(),
  };
}

function readyReceipt(selection: string): StraightReceipt {
  return {
    kind: "straight",
    selection,
    market: "Moneyline",
    oddsAmerican: -110,
    loggedPreGame: true,
    oddsVerified: true,
    tier: "VERIFIED",
    units: 1,
    toWinUnits: 0.909,
    capturedAt: new Date("2026-07-14T12:00:00.000Z").toISOString(),
    book: "fanduel",
  };
}

test("shapeBulkSinglesOutcome: all clean → write", () => {
  const preps: BulkLinePrep[] = [
    { status: "ready", moveKey: "a", receipt: readyReceipt("A") },
    { status: "ready", moveKey: "b", receipt: readyReceipt("B") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "write");
  if (shaped.phase !== "write") return;
  assert.equal(shaped.ready.length, 2);
  assert.equal(shaped.unavailable.length, 0);
});

test("shapeBulkSinglesOutcome: any needs_confirm blocks write (Cancel writes nothing)", () => {
  const preps: BulkLinePrep[] = [
    { status: "ready", moveKey: "a", receipt: readyReceipt("A") },
    { status: "needs_confirm", moved: moved("b", "changed") },
    { status: "unavailable", moved: moved("c", "unavailable") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "needs_confirm");
  if (shaped.phase !== "needs_confirm") return;
  assert.equal(shaped.needsConfirm.length, 1);
  assert.equal(shaped.needsConfirm[0]!.moveKey, "b");
  assert.equal(shaped.unavailable.length, 1);
  assert.equal(shaped.unavailable[0]!.moveKey, "c");
});

test("shapeBulkSinglesOutcome: clean + unavailable → partial write", () => {
  const preps: BulkLinePrep[] = [
    { status: "ready", moveKey: "a", receipt: readyReceipt("A") },
    { status: "ready", moveKey: "b", receipt: readyReceipt("B") },
    { status: "unavailable", moved: moved("c", "unavailable") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "write");
  if (shaped.phase !== "write") return;
  assert.deepEqual(
    shaped.ready.map((r) => r.moveKey),
    ["a", "b"],
  );
  assert.equal(shaped.unavailable.length, 1);
  assert.equal(shaped.unavailable[0]!.moveKey, "c");
});

test("shapeBulkSinglesOutcome: unavailable only → no write", () => {
  const preps: BulkLinePrep[] = [
    { status: "unavailable", moved: moved("c", "unavailable") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "unavailable_only");
  if (shaped.phase !== "unavailable_only") return;
  assert.equal(shaped.unavailable.length, 1);
});

test("shapeBulkSinglesOutcome: aggregates multiple needsConfirm", () => {
  const preps: BulkLinePrep[] = [
    { status: "needs_confirm", moved: moved("a", "changed") },
    { status: "needs_confirm", moved: moved("b", "changed") },
    { status: "ready", moveKey: "c", receipt: readyReceipt("C") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "needs_confirm");
  if (shaped.phase !== "needs_confirm") return;
  assert.equal(shaped.needsConfirm.length, 2);
});

test("buildBulkSinglesReceipt: full success summary", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A"), readyReceipt("B"), readyReceipt("C")],
    attemptedCount: 3,
    suspendedMoveKeys: [],
    writtenMoveKeys: ["a", "b", "c"],
  });
  assert.equal(receipt.kind, "bulk");
  assert.equal(receipt.submittedCount, 3);
  assert.equal(receipt.summaryLine, "3 picks verified");
  assert.equal(receipt.suspendedCount, 0);
  assert.deepEqual(receipt.writtenMoveKeys, ["a", "b", "c"]);
});

test("buildBulkSinglesReceipt: partial N of M + suspended keys", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A"), readyReceipt("B")],
    attemptedCount: 3,
    suspendedMoveKeys: ["c"],
    writtenMoveKeys: ["a", "b"],
  });
  assert.equal(receipt.submittedCount, 2);
  assert.equal(receipt.attemptedCount, 3);
  assert.equal(receipt.suspendedCount, 1);
  assert.equal(receipt.summaryLine, "2 of 3 submitted; 1 line suspended");
  assert.deepEqual(receipt.suspendedMoveKeys, ["c"]);
});
