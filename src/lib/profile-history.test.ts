import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  compareHistoryKeysDesc,
  decodeHistoryCursor,
  encodeHistoryCursor,
  entriesThroughWatermark,
  historyBatchWatermark,
  mergeHistoryEntries,
  type PublicParlayView,
} from "./profile-history";
import type { PlayView } from "./queries/plays";

function source(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function play(id: string, iso: string): { kind: "play" } & PlayView {
  return {
    kind: "play",
    id,
    sport: "MLB",
    league: "MLB",
    market: "Moneyline",
    selection: `Pick ${id}`,
    oddsAmerican: -110,
    units: 1,
    outcome: "WIN",
    profitUnits: 0.91,
    createdAt: new Date(iso),
    verificationTier: "VERIFIED",
    side: null,
    eventStartsAt: null,
    book: null,
    notes: null,
  };
}

function parlay(
  id: string,
  iso: string,
): { kind: "parlay" } & PublicParlayView {
  return {
    kind: "parlay",
    id,
    combinedOddsAmerican: 265,
    units: 3,
    outcome: "WIN",
    profitUnits: 7.95,
    createdAt: new Date(iso),
    verificationTier: "VERIFIED",
    eventStartsAt: new Date(iso),
    legs: [],
  };
}

test("merged ledger interleaves parlays with straight plays, newest first", () => {
  const merged = mergeHistoryEntries(
    [play("p1", "2026-08-04T18:00:00Z")],
    [
      parlay("x1", "2026-08-07T18:00:00Z"),
      parlay("x2", "2026-08-05T18:00:00Z"),
    ],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["x1", "x2", "p1"],
  );
});

test("same-instant rows break the tie by id, so no row is skipped", () => {
  const instant = "2026-08-07T18:00:00Z";
  const merged = mergeHistoryEntries(
    [play("aaa", instant)],
    [parlay("bbb", instant)],
  );

  assert.deepEqual(
    merged.map((entry) => entry.id),
    ["bbb", "aaa"],
  );
  assert.ok(
    compareHistoryKeysDesc(
      { createdAt: new Date(instant), id: "bbb" },
      { createdAt: new Date(instant), id: "aaa" },
    ) < 0,
  );
});

test("a full stream caps the batch at its own tail", () => {
  // Plays came back full at 08-06; parlays were exhausted at 08-01. Anything
  // below the play tail may still exist unread, so the batch stops there.
  const watermark = historyBatchWatermark({
    playTail: { createdAt: new Date("2026-08-06T00:00:00Z"), id: "p9" },
    playFull: true,
    parlayTail: { createdAt: new Date("2026-08-01T00:00:00Z"), id: "x9" },
    parlayFull: false,
  });

  assert.equal(watermark?.id, "p9");
  const kept = entriesThroughWatermark(
    mergeHistoryEntries(
      [play("p9", "2026-08-06T00:00:00Z")],
      [
        parlay("x5", "2026-08-07T00:00:00Z"),
        parlay("x9", "2026-08-01T00:00:00Z"),
      ],
    ),
    watermark,
  );

  // x9 is dropped for now — it sorts below the unread play rows and is picked
  // up by the next batch rather than being shown out of order.
  assert.deepEqual(
    kept.map((entry) => entry.id),
    ["x5", "p9"],
  );
});

test("the newest full stream wins the watermark", () => {
  const watermark = historyBatchWatermark({
    playTail: { createdAt: new Date("2026-08-01T00:00:00Z"), id: "p9" },
    playFull: true,
    parlayTail: { createdAt: new Date("2026-08-06T00:00:00Z"), id: "x9" },
    parlayFull: true,
  });

  assert.equal(watermark?.id, "x9");
});

test("both streams exhausted leaves the batch uncut", () => {
  const watermark = historyBatchWatermark({
    playTail: { createdAt: new Date("2026-08-01T00:00:00Z"), id: "p9" },
    playFull: false,
    parlayTail: { createdAt: new Date("2026-08-06T00:00:00Z"), id: "x9" },
    parlayFull: false,
  });

  assert.equal(watermark, null);
  assert.equal(
    entriesThroughWatermark([play("p1", "2026-08-04T18:00:00Z")], watermark)
      .length,
    1,
  );
});

test("the cursor round-trips a keyset position across both tables", () => {
  const key = { createdAt: new Date("2026-08-07T18:00:00Z"), id: "x1" };
  const decoded = decodeHistoryCursor(encodeHistoryCursor(key));

  assert.equal(decoded?.id, "x1");
  assert.equal(decoded?.createdAt.toISOString(), key.createdAt.toISOString());
});

test("a legacy bare-id cursor decodes to null so the caller can resolve it", () => {
  assert.equal(decodeHistoryCursor("cms8lvgno02asel30xgd71kw9"), null);
  assert.equal(decodeHistoryCursor(""), null);
  assert.equal(decodeHistoryCursor(null), null);
  assert.equal(decodeHistoryCursor("not-a-date~someid"), null);
});

test("the public profile ledger reads parlays, not only straight plays", () => {
  const capperSource = source("src/lib/queries/capper.ts");
  const historyQuery = capperSource.slice(
    capperSource.indexOf("export async function getPublicProfileHistoryPage"),
    capperSource.indexOf("function historyKeysetWhere"),
  );

  assert.match(historyQuery, /prisma\.parlay\.findMany/);
  assert.match(historyQuery, /prisma\.play\.findMany/);
  // Legs stay display-only components of their parent position.
  assert.match(historyQuery, /parlayId: null/);
});
