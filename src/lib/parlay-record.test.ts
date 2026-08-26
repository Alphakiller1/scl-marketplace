import assert from "node:assert/strict";
import { test } from "node:test";

import {
  PARLAY_MARKET_LABEL,
  earliestLegStart,
  parlayToRecordView,
  type ParlayRecordRow,
} from "@/lib/parlay-record";

function leg(over: Partial<ParlayRecordRow["legs"][number]> = {}) {
  return {
    id: "leg-1",
    sport: "MLB",
    market: "Moneyline",
    selection: "Yankees ML",
    oddsAmerican: -120,
    side: "Yankees",
    book: "draftkings",
    verificationTier: "VERIFIED" as const,
    eventStartsAt: new Date("2026-08-20T23:05:00.000Z"),
    ...over,
  };
}

function parlay(over: Partial<ParlayRecordRow> = {}): ParlayRecordRow {
  return {
    id: "parlay-1",
    combinedOddsAmerican: 147,
    units: "3.00",
    outcome: "WIN",
    profitUnits: "4.41",
    createdAt: new Date("2026-08-20T14:05:47.244Z"),
    legs: [leg(), leg({ id: "leg-2", selection: "Mets ML" })],
    ...over,
  };
}

test("a parlay becomes one position of record, not a row per leg", () => {
  const view = parlayToRecordView(parlay());
  assert.equal(view.id, "parlay-1");
  assert.equal(view.market, PARLAY_MARKET_LABEL);
  assert.equal(view.selection, "2-leg parlay");
  assert.equal(view.units, 3);
  assert.equal(view.profitUnits, 4.41);
  assert.equal(view.oddsAmerican, 147);
  assert.equal(view.parlayLegs?.length, 2);
});

test("a parlay with no stored combined price yields 0 so renderers can em-dash it", () => {
  // Every LOSS parlay in production carries a null combined price; rendering
  // that as +0 or EVEN would invent a number the capper never posted.
  const view = parlayToRecordView(parlay({ combinedOddsAmerican: null }));
  assert.equal(view.oddsAmerican, 0);
});

test("verification is VERIFIED only when every leg is", () => {
  const allVerified = parlayToRecordView(parlay());
  assert.equal(allVerified.verificationTier, "VERIFIED");

  const mixed = parlayToRecordView(
    parlay({
      legs: [leg(), leg({ id: "leg-2", verificationTier: "SELF_REPORTED" })],
    }),
  );
  assert.equal(mixed.verificationTier, "SELF_REPORTED");
});

test("an empty parlay is never VERIFIED by vacuous truth", () => {
  const view = parlayToRecordView(parlay({ legs: [] }));
  assert.equal(view.verificationTier, "SELF_REPORTED");
  assert.equal(view.selection, "0-leg parlay");
});

test("lifecycle anchors to the earliest leg start", () => {
  const early = new Date("2026-08-20T17:10:00.000Z");
  const view = parlayToRecordView(
    parlay({
      legs: [
        leg({ eventStartsAt: new Date("2026-08-20T23:05:00.000Z") }),
        leg({ id: "leg-2", eventStartsAt: early }),
      ],
    }),
  );
  assert.equal(view.eventStartsAt?.toISOString(), early.toISOString());
});

test("earliestLegStart ignores legs with no start and returns null when none have one", () => {
  const known = new Date("2026-08-20T17:10:00.000Z");
  assert.equal(
    earliestLegStart([
      { eventStartsAt: null },
      { eventStartsAt: known },
    ])?.toISOString(),
    known.toISOString(),
  );
  assert.equal(earliestLegStart([{ eventStartsAt: null }]), null);
  assert.equal(earliestLegStart([]), null);
});

test("sport is attributed to the first leg so sport filters still read truthfully", () => {
  const view = parlayToRecordView(
    parlay({ legs: [leg({ sport: "WNBA" }), leg({ id: "leg-2" })] }),
  );
  assert.equal(view.sport, "WNBA");
  // A parlay spans games, so it claims no single event label or book.
  assert.equal(view.eventLabel, null);
  assert.equal(view.book, null);
  assert.equal(view.league, null);
});
