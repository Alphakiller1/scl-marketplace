import assert from "node:assert/strict";
import test from "node:test";

import {
  canAddLeg,
  conflictKey,
  findConflict,
  findInternalParlayConflicts,
  pickKey,
  seedSinglesUnitsFromParlayStake,
  selectedKeysFromSelections,
  toSlipLeg,
  toSlipSelection,
  type SlipPick,
} from "@/lib/slip";

function leg(
  partial: Partial<SlipPick> & Pick<SlipPick, "market" | "side">,
): SlipPick {
  return {
    eventId: "evt-1",
    oddsAmerican: -110,
    ...partial,
  };
}

test("pickKey treats exact repeats as identical", () => {
  const a = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
  });
  const b = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
  });
  assert.equal(pickKey(a), pickKey(b));
});

test("pickKey distinguishes the source book at the same price", () => {
  const draftKings = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
    book: "draftkings",
  });
  const fanDuel = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
    book: "fanduel",
  });

  assert.notEqual(pickKey(draftKings), pickKey(fanDuel));
  assert.equal(findConflict([draftKings], fanDuel)?.kind, "spread");
});

test("exact duplicate detection", () => {
  const existing = [
    leg({ market: "Moneyline", side: "Lakers", oddsAmerican: -140 }),
  ];
  const conflict = findConflict(existing, existing[0]!);
  assert.ok(conflict);
  assert.equal(conflict.kind, "duplicate");
  assert.equal(canAddLeg(existing, existing[0]!), false);
});

test("same event moneyline conflict (opposite side)", () => {
  const existing = [
    leg({ market: "Moneyline", side: "Lakers", oddsAmerican: -140 }),
  ];
  const opposite = leg({
    market: "Moneyline",
    side: "Celtics",
    oddsAmerican: +120,
  });
  assert.equal(conflictKey(existing[0]!), conflictKey(opposite));
  const conflict = findConflict(existing, opposite);
  assert.ok(conflict);
  assert.equal(conflict.kind, "moneyline");
  assert.match(conflict.message, /Moneyline/i);
  assert.equal(canAddLeg(existing, opposite), false);
});

test("same event spread vs alternate spread conflict", () => {
  const main = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
  });
  const alt = leg({
    market: "Spread",
    side: "Lakers",
    line: -6.5,
    oddsAmerican: -105,
  });
  assert.equal(conflictKey(main), conflictKey(alt));
  const conflict = findConflict([main], alt);
  assert.ok(conflict);
  assert.equal(conflict.kind, "spread");
  assert.equal(canAddLeg([main], alt), false);
});

test("same event total vs alternate total conflict", () => {
  const main = leg({
    market: "Total",
    side: "Over",
    line: 220.5,
    oddsAmerican: -110,
  });
  const alt = leg({
    market: "Total",
    side: "Under",
    line: 215.5,
    oddsAmerican: -105,
  });
  assert.equal(conflictKey(main), conflictKey(alt));
  const conflict = findConflict([main], alt);
  assert.ok(conflict);
  assert.equal(conflict.kind, "total");
  assert.equal(canAddLeg([main], alt), false);
});

test("same player same prop market conflict (alt line / opposite side)", () => {
  const over = leg({
    market: "Strikeouts",
    side: "Over",
    line: 5.5,
    player: "Shohei Ohtani",
    oddsAmerican: -115,
  });
  const underAlt = leg({
    market: "Strikeouts",
    side: "Under",
    line: 6.5,
    player: "Shohei Ohtani",
    oddsAmerican: -105,
  });
  assert.equal(conflictKey(over), conflictKey(underAlt));
  const conflict = findConflict([over], underAlt);
  assert.ok(conflict);
  assert.equal(conflict.kind, "player_prop");
  assert.match(conflict.message, /Strikeouts/);
  assert.equal(canAddLeg([over], underAlt), false);
});

test("different players same prop market allowed", () => {
  const a = leg({
    market: "Points",
    side: "Over",
    line: 25.5,
    player: "Jayson Tatum",
    oddsAmerican: -110,
  });
  const b = leg({
    market: "Points",
    side: "Over",
    line: 27.5,
    player: "Jaylen Brown",
    oddsAmerican: -105,
  });
  assert.notEqual(conflictKey(a), conflictKey(b));
  assert.equal(findConflict([a], b), null);
  assert.equal(canAddLeg([a], b), true);
});

test("different teams' totals from the same sportsbook can share a parlay", () => {
  const yankees = leg({
    market: "Team Total",
    selection: "New York Yankees Over 4.5",
    side: "Over",
    line: 4.5,
    oddsAmerican: -110,
    book: "draftkings",
  });
  const redSox = leg({
    market: "Team Total",
    selection: "Boston Red Sox Over 4.5",
    side: "Over",
    line: 4.5,
    oddsAmerican: -110,
    book: "draftkings",
  });

  assert.notEqual(pickKey(yankees), pickKey(redSox));
  assert.notEqual(conflictKey(yankees), conflictKey(redSox));
  assert.equal(findConflict([yankees], redSox), null);
  assert.equal(canAddLeg([yankees], redSox), true);
  assert.deepEqual(findInternalParlayConflicts([yankees, redSox]), []);
});

test("alternate team totals for the same team remain a parlay conflict", () => {
  const main = leg({
    market: "Team Total",
    selection: "New York Yankees Over 4.5",
    side: "Over",
    line: 4.5,
    oddsAmerican: -110,
    book: "draftkings",
  });
  const alternate = leg({
    market: "Team Total",
    selection: "New York Yankees Under 5.5",
    side: "Under",
    line: 5.5,
    oddsAmerican: -105,
    book: "draftkings",
  });

  assert.equal(conflictKey(main), conflictKey(alternate));
  const conflict = findConflict([main], alternate);
  assert.equal(conflict?.kind, "team_total");
  assert.equal(
    conflict?.message,
    "This parlay already has a Team Total for this team.",
  );
  assert.equal(canAddLeg([main], alternate), false);
});

test("team-total identity distinguishes clubs even when book and price differ", () => {
  const yankees = leg({
    market: "Team Total",
    selection: "New York Yankees Over 4.5",
    side: "Over",
    line: 4.5,
    oddsAmerican: -115,
    book: "draftkings",
  });
  const redSox = leg({
    market: "Team Total",
    selection: "Boston Red Sox Over 4.5",
    side: "Over",
    line: 4.5,
    oddsAmerican: -105,
    book: "fanduel",
  });

  assert.equal(findConflict([yankees], redSox), null);
  assert.equal(canAddLeg([yankees], redSox), true);
});

test("different games same market allowed", () => {
  const game1 = leg({
    eventId: "evt-1",
    market: "Total",
    side: "Over",
    line: 220.5,
    oddsAmerican: -110,
  });
  const game2 = leg({
    eventId: "evt-2",
    market: "Total",
    side: "Over",
    line: 210.5,
    oddsAmerican: -108,
  });
  assert.notEqual(conflictKey(game1), conflictKey(game2));
  assert.equal(findConflict([game1], game2), null);
  assert.equal(canAddLeg([game1], game2), true);
});

test("parlay allows legs from different sportsbooks", () => {
  const draftKings = leg({
    eventId: "evt-1",
    market: "Moneyline",
    side: "Lakers",
    book: "draftkings",
  });
  const fanDuel = leg({
    eventId: "evt-2",
    market: "Moneyline",
    side: "Celtics",
    book: "fanduel",
  });
  const conflict = findConflict([draftKings], fanDuel);
  assert.equal(conflict, null);
  assert.equal(canAddLeg([draftKings], fanDuel), true);
});

test("mode switch does not flag mixed-sportsbook parlay legs", () => {
  const conflicts = findInternalParlayConflicts([
    leg({ market: "Moneyline", side: "Lakers", book: "draftkings" }),
    leg({
      eventId: "evt-2",
      market: "Spread",
      side: "Celtics",
      book: "fanduel",
    }),
  ]);
  assert.equal(conflicts.length, 0);
});

test("different market families on same game are allowed", () => {
  const ml = leg({ market: "Moneyline", side: "Lakers", oddsAmerican: -140 });
  const spread = leg({
    market: "Spread",
    side: "Lakers",
    line: -3.5,
    oddsAmerican: -110,
  });
  const total = leg({
    market: "Total",
    side: "Over",
    line: 220.5,
    oddsAmerican: -110,
  });
  assert.equal(canAddLeg([ml], spread), true);
  assert.equal(canAddLeg([ml, spread], total), true);
});

test("toSlipLeg carries sport + book from the board pick", () => {
  const payload = toSlipLeg({
    eventId: "evt-1",
    market: "Moneyline",
    selection: "Lakers",
    side: "Lakers",
    oddsAmerican: -140,
    eventStartsAt: "2026-07-14T23:00:00.000Z",
    sport: "NBA",
    book: "draftkings",
  });
  assert.equal(payload.sport, "NBA");
  assert.equal(payload.book, "draftkings");
  assert.equal(payload.selection, "Lakers");
});

test("findInternalParlayConflicts surfaces same-market pairs already on the slip", () => {
  const over = leg({
    market: "Total",
    side: "Over",
    line: 9.5,
    oddsAmerican: -110,
  });
  const under = leg({
    market: "Total",
    side: "Under",
    line: 9.5,
    oddsAmerican: -110,
  });
  const conflicts = findInternalParlayConflicts([over, under]);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0]!.message, /Total/i);
});

test("singles allow same-market Over/Under as separate selections (no add conflict)", () => {
  // Multi-select singles: Over + Under is legal; only parlay findConflict blocks.
  const over = leg({
    market: "Total",
    side: "Over",
    line: 9.5,
    oddsAmerican: -110,
  });
  const under = leg({
    market: "Total",
    side: "Under",
    line: 9.5,
    oddsAmerican: -110,
  });
  // findConflict still reports for parlay path:
  assert.ok(findConflict([over], under));
  // Internal helper used on mode switch:
  assert.equal(findInternalParlayConflicts([over, under]).length, 1);
});

test("seedSinglesUnitsFromParlayStake copies parlay stake onto every row", () => {
  const a = toSlipSelection(
    {
      eventId: "evt-1",
      market: "Moneyline",
      selection: "Lakers",
      side: "Lakers",
      oddsAmerican: -140,
      eventStartsAt: "2026-07-14T23:00:00.000Z",
      sport: "NBA",
    },
    0.5,
  );
  const b = toSlipSelection(
    {
      eventId: "evt-2",
      market: "Moneyline",
      selection: "Celtics",
      side: "Celtics",
      oddsAmerican: +120,
      eventStartsAt: "2026-07-14T23:00:00.000Z",
      sport: "NBA",
    },
    2,
  );
  const seeded = seedSinglesUnitsFromParlayStake([a, b], 1.5);
  assert.equal(seeded[0]!.units, 1.5);
  assert.equal(seeded[1]!.units, 1.5);
  assert.equal(seeded[0]!.selection, "Lakers");
});

test("selectedKeysFromSelections mirrors pickKey set", () => {
  const a = toSlipSelection(
    {
      eventId: "evt-1",
      market: "Moneyline",
      selection: "Lakers",
      side: "Lakers",
      oddsAmerican: -140,
      eventStartsAt: "2026-07-14T23:00:00.000Z",
      sport: "NBA",
    },
    1,
  );
  const keys = selectedKeysFromSelections([a]);
  assert.equal(keys.size, 1);
  assert.equal(keys.has(pickKey(a)), true);
});
