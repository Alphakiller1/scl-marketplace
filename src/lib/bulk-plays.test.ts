import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildBulkSinglesReceipt,
  shapeBulkSinglesOutcome,
  shortenBulkFailReason,
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
  assert.equal(shaped.failed.length, 0);
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
  assert.equal(shaped.failed.length, 0);
});

test("shapeBulkSinglesOutcome: clean + C1-failed → write with failed surfaced", () => {
  const preps: BulkLinePrep[] = [
    { status: "ready", moveKey: "a", receipt: readyReceipt("A") },
    { status: "ready", moveKey: "b", receipt: readyReceipt("B") },
    {
      status: "error",
      error: "Event already started — lock at the scheduled start.",
      moveKey: "c",
      selection: "Team C ML",
      market: "Moneyline",
    },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "write");
  if (shaped.phase !== "write") return;
  assert.equal(shaped.ready.length, 2);
  assert.equal(shaped.failed.length, 1);
  assert.equal(shaped.failed[0]!.selection, "Team C ML");
  assert.equal(shaped.failed[0]!.reason, "no longer pre-game");
  assert.equal(shaped.unavailable.length, 0);
});

test("shapeBulkSinglesOutcome: mixed clean / failed / unavailable", () => {
  const preps: BulkLinePrep[] = [
    { status: "ready", moveKey: "a", receipt: readyReceipt("A") },
    {
      status: "error",
      error: "Event already started — lock at the scheduled start.",
      moveKey: "b",
      selection: "B",
      market: "Moneyline",
    },
    { status: "unavailable", moved: moved("c", "unavailable") },
  ];
  const shaped = shapeBulkSinglesOutcome(preps);
  assert.equal(shaped.phase, "write");
  if (shaped.phase !== "write") return;
  assert.equal(shaped.ready.length, 1);
  assert.equal(shaped.failed.length, 1);
  assert.equal(shaped.unavailable.length, 1);
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

test("shortenBulkFailReason: pre-game lock copy", () => {
  assert.equal(
    shortenBulkFailReason(
      "Event already started — lock at the scheduled start.",
    ),
    "no longer pre-game",
  );
});

test("buildBulkSinglesReceipt: full success summary", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A"), readyReceipt("B"), readyReceipt("C")],
    attemptedCount: 3,
    writtenMoveKeys: ["a", "b", "c"],
  });
  assert.equal(receipt.kind, "bulk");
  assert.equal(receipt.submittedCount, 3);
  assert.equal(receipt.summaryLine, "3 picks verified");
  assert.equal(receipt.suspendedCount, 0);
  assert.equal(receipt.failedCount, 0);
  assert.deepEqual(receipt.writtenMoveKeys, ["a", "b", "c"]);
});

test("buildBulkSinglesReceipt: partial N of M + suspended", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A"), readyReceipt("B")],
    attemptedCount: 3,
    writtenMoveKeys: ["a", "b"],
    suspended: [
      {
        kind: "suspended",
        selection: "C",
        reason: "line unavailable or suspended",
        moveKey: "c",
      },
    ],
  });
  assert.equal(receipt.submittedCount, 2);
  assert.equal(receipt.attemptedCount, 3);
  assert.equal(receipt.suspendedCount, 1);
  assert.equal(receipt.summaryLine, "2 of 3 submitted · 1 suspended");
  assert.deepEqual(receipt.suspendedMoveKeys, ["c"]);
});

test("buildBulkSinglesReceipt: mixed clean/failed summary is honest", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A"), readyReceipt("B")],
    attemptedCount: 3,
    writtenMoveKeys: ["a", "b"],
    failed: [
      {
        kind: "failed",
        selection: "Team C ML",
        reason: "no longer pre-game",
        moveKey: "c",
        market: "Moneyline",
      },
    ],
  });
  assert.equal(receipt.failedCount, 1);
  assert.equal(
    receipt.summaryLine,
    "2 of 3 submitted · 1 couldn't be verified",
  );
  assert.equal(receipt.failed[0]!.reason, "no longer pre-game");
});

test("buildBulkSinglesReceipt: failed + suspended both shown in summary", () => {
  const receipt = buildBulkSinglesReceipt({
    picks: [readyReceipt("A")],
    attemptedCount: 3,
    writtenMoveKeys: ["a"],
    failed: [
      {
        kind: "failed",
        selection: "B",
        reason: "no longer pre-game",
        moveKey: "b",
      },
    ],
    suspended: [
      {
        kind: "suspended",
        selection: "C",
        reason: "line unavailable or suspended",
        moveKey: "c",
      },
    ],
  });
  assert.equal(
    receipt.summaryLine,
    "1 of 3 submitted · 1 couldn't be verified · 1 suspended",
  );
  assert.equal(receipt.failedCount, 1);
  assert.equal(receipt.suspendedCount, 1);
});
