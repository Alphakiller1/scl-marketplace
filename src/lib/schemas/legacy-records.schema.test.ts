import assert from "node:assert/strict";
import { test } from "node:test";

import { legacyRecordsImportSchema } from "@/lib/schemas/legacy-records.schema";

const entry = (over: Record<string, unknown> = {}) => ({
  scope: "PRE_IMPORT",
  sport: "ALL",
  wins: 10,
  losses: 8,
  pushes: 1,
  unitsRisked: 20.5,
  unitsNet: -1.25,
  ...over,
});

const capper = (over: Record<string, unknown> = {}) => ({
  username: "wgs",
  capturedAt: "2026-07-30T21:17:00-04:00",
  records: [entry()],
  ...over,
});

test("accepts a well-formed carried-over record", () => {
  const parsed = legacyRecordsImportSchema.safeParse([capper()]);
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data[0].records[0].wins, 10);
    assert.ok(parsed.data[0].capturedAt instanceof Date);
  }
});

test("rejects a record with no settled results", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({ records: [entry({ wins: 0, losses: 0, pushes: 0 })] }),
  ]);
  assert.equal(parsed.success, false);
});

test("rejects settled results with zero units risked (ROI would be undefined)", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({ records: [entry({ unitsRisked: 0 })] }),
  ]);
  assert.equal(parsed.success, false);
});

test("rejects a duplicate scope/sport pair for one capper", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({ records: [entry(), entry({ wins: 3 })] }),
  ]);
  assert.equal(parsed.success, false);
});

test("allows the same scope across different sports", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({ records: [entry(), entry({ sport: "MLB" })] }),
  ]);
  assert.equal(parsed.success, true);
});

test("rejects two entries for the same capper", () => {
  const parsed = legacyRecordsImportSchema.safeParse([capper(), capper()]);
  assert.equal(parsed.success, false);
});

test("rejects a username that is not a valid public handle", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({ username: "not a handle!" }),
  ]);
  assert.equal(parsed.success, false);
});

test("allows a negative net while requiring non-negative risk", () => {
  assert.equal(
    legacyRecordsImportSchema.safeParse([
      capper({ records: [entry({ unitsNet: -99 })] }),
    ]).success,
    true,
  );
  assert.equal(
    legacyRecordsImportSchema.safeParse([
      capper({ records: [entry({ unitsRisked: -1 })] }),
    ]).success,
    false,
  );
});

test("rejects nonzero units for a push-only record", () => {
  const parsed = legacyRecordsImportSchema.safeParse([
    capper({
      records: [
        entry({
          wins: 0,
          losses: 0,
          pushes: 2,
          unitsRisked: 489.29,
          unitsNet: 134.43,
        }),
      ],
    }),
  ]);

  assert.equal(parsed.success, false);
});
