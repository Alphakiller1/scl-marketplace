import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyCandidates,
  normalizePickText,
  outcomeAllowedForMatch,
  planCorrection,
  relatedPick,
  sameEvent,
  samePick,
  type CorrectionPlay,
} from "@/lib/bulk-correction";

let seq = 0;
function play(overrides: Partial<CorrectionPlay> = {}): CorrectionPlay {
  seq += 1;
  return {
    id: `p${seq}`,
    capperId: `c${seq}`,
    capperLabel: `@capper${seq}`,
    sport: "NFL",
    market: "Spread",
    selection: "Kansas City Chiefs -3.5",
    side: "Kansas City Chiefs",
    line: -3.5,
    eventId: "evt-1",
    eventLabel: "Buffalo Bills @ Kansas City Chiefs",
    homeTeam: "Kansas City Chiefs",
    awayTeam: "Buffalo Bills",
    eventStartsAt: "2026-11-09T01:20:00.000Z",
    createdAt: "2026-11-08T15:00:00.000Z",
    oddsAmerican: -110,
    units: 1,
    outcome: "LOSS",
    profitUnits: -1,
    parlay: null,
    ...overrides,
  };
}

test("normalization folds case, accents, dashes and spacing — nothing looser", () => {
  assert.equal(
    normalizePickText("  José  Ramírez  Over 1.5 "),
    "jose ramirez over 1.5",
  );
  assert.equal(normalizePickText("Chiefs −3.5"), "chiefs -3.5");
  assert.notEqual(
    normalizePickText("Chiefs -3.5"),
    normalizePickText("Chiefs -4"),
  );
});

test("the same pick: same event, market, selection, side and line", () => {
  const source = play();
  assert.ok(samePick(source, play({ selection: "kansas city chiefs  -3.5" })));
  assert.ok(
    !samePick(
      source,
      play({ selection: "Kansas City Chiefs -4.5", line: -4.5 }),
    ),
  );
  assert.ok(!samePick(source, play({ market: "1st Half Spread" })));
  assert.ok(!samePick(source, play({ eventId: "evt-2" })));
  // Stored side/line disagreeing with otherwise-equal text is not the same bet.
  assert.ok(!samePick(source, play({ line: -4 })));
  // Rows without structured side/line still match on the selection text.
  assert.ok(samePick(source, play({ side: null, line: null })));
});

test("player props: the selection names the player — same side and line is NOT the same pick", () => {
  // Real shape from production: one event, market "Passing TDs", side "Over",
  // line 0.5, two different quarterbacks. Matching on side+line would void or
  // regrade the wrong player's pick.
  const mahomes = play({
    market: "Passing TDs",
    selection: "Patrick Mahomes Over 0.5",
    side: "Over",
    line: 0.5,
  });
  const darnold = play({
    market: "Passing TDs",
    selection: "Sam Darnold Over 0.5",
    side: "Over",
    line: 0.5,
  });
  assert.ok(!samePick(mahomes, darnold));
  assert.ok(!relatedPick(mahomes, darnold));
  assert.ok(
    samePick(mahomes, play({ ...mahomes, id: "x", capperId: "other" })),
  );
});

test("same event across feeds: provider id wins, fixture fallback only for unbound legacy rows", () => {
  const bound = play();
  // Same clubs, different provider event (doubleheader / other game) — never the same.
  assert.ok(!sameEvent(bound, play({ eventId: "evt-game-2" })));
  // Legacy row with no event id, same clubs within the window — same game.
  const legacy = play({
    eventId: null,
    eventStartsAt: null,
    createdAt: "2026-11-09T01:20:00.000Z",
    homeTeam: "kansas city chiefs",
    awayTeam: "Buffalo Bills",
  });
  assert.ok(sameEvent(bound, legacy));
  // Same clubs 3.5 hours apart — the second game of a doubleheader, not this one.
  assert.ok(
    !sameEvent(
      bound,
      play({ eventId: null, eventStartsAt: "2026-11-09T04:50:00.000Z" }),
    ),
  );
  // Home/away swapped is a different fixture.
  assert.ok(
    !sameEvent(
      bound,
      play({
        eventId: null,
        homeTeam: "Buffalo Bills",
        awayTeam: "Kansas City Chiefs",
      }),
    ),
  );
  // Nothing to match on: only the play itself.
  const bare = play({ eventId: null, homeTeam: null, awayTeam: null });
  assert.ok(
    !sameEvent(bare, play({ eventId: null, homeTeam: null, awayTeam: null })),
  );
});

test("related picks: every prop on the same player, or the same game-line market at another line/side", () => {
  const source = play({
    market: "Receiving Yds",
    selection: "George Pickens Over 29.5",
    side: "Over",
    line: 29.5,
  });
  assert.ok(
    relatedPick(
      source,
      play({
        market: "Receiving Yds",
        selection: "George Pickens Under 29.5",
        side: "Under",
        line: 29.5,
      }),
    ),
  );
  assert.ok(
    relatedPick(
      source,
      play({
        market: "Receptions",
        selection: "George Pickens Over 2.5",
        side: "Over",
        line: 2.5,
      }),
    ),
  );
  assert.ok(
    !relatedPick(
      source,
      play({
        market: "Receiving Yds",
        selection: "Hollywood Brown Over 29.5",
        side: "Over",
        line: 29.5,
      }),
    ),
  );
  // Other game entirely.
  assert.ok(
    !relatedPick(
      source,
      play({
        eventId: "evt-9",
        market: "Receptions",
        selection: "George Pickens Over 2.5",
      }),
    ),
  );

  const spread = play();
  assert.ok(
    relatedPick(
      spread,
      play({
        selection: "Buffalo Bills +3.5",
        side: "Buffalo Bills",
        line: 3.5,
      }),
    ),
  );
  assert.ok(
    relatedPick(spread, play({ selection: "Kansas City Chiefs -4", line: -4 })),
  );
  assert.ok(
    !relatedPick(
      spread,
      play({
        market: "Total",
        selection: "Over 47.5",
        side: "Over",
        line: 47.5,
      }),
    ),
  );
});

test("classification puts the source first, sorts the rest, and never lists a play twice", () => {
  const source = play({ capperLabel: "@zed" });
  const a = play({ capperLabel: "@bravo" });
  const b = play({ capperLabel: "@Alpha" });
  const other = play({
    selection: "Buffalo Bills +3.5",
    side: "Buffalo Bills",
    line: 3.5,
    capperLabel: "@m",
  });
  const unrelated = play({
    market: "Total",
    selection: "Under 47.5",
    side: "Under",
    line: 47.5,
  });
  const result = classifyCandidates(source, [
    a,
    source,
    b,
    other,
    unrelated,
    a,
  ]);
  assert.deepEqual(
    result.exact.map((p) => p.capperLabel),
    ["@zed", "@Alpha", "@bravo"],
  );
  assert.deepEqual(
    result.related.map((p) => p.id),
    [other.id],
  );
});

test("only a void may be applied to a pick at another line or side", () => {
  for (const outcome of ["WIN", "LOSS", "PUSH", "VOID"] as const) {
    assert.equal(outcomeAllowedForMatch(outcome, "exact"), true);
    assert.equal(
      outcomeAllowedForMatch(outcome, "related"),
      outcome === "VOID",
    );
  }
});

test("straight bets: profit comes from each play's own odds and stake", () => {
  const plan = planCorrection("WIN", [
    play({ oddsAmerican: 150, units: 2, outcome: "LOSS", profitUnits: -2 }),
    play({ oddsAmerican: -110, units: 1, outcome: "LOSS", profitUnits: -1 }),
    play({ oddsAmerican: -110, units: 1, outcome: "WIN", profitUnits: 0.91 }),
  ]);
  assert.deepEqual(
    plan.straights.map((s) => [
      s.after.outcome,
      s.after.profitUnits,
      s.changed,
    ]),
    [
      ["WIN", 3, true],
      ["WIN", 0.91, true],
      ["WIN", 0.91, false],
    ],
  );
  assert.equal(plan.changedPlayCount, 2);
  assert.equal(plan.unchangedPlayCount, 1);
  assert.equal(plan.affectedCapperCount, 2);
  // (-2 → +3) + (-1 → +0.91)
  assert.equal(plan.profitDelta, 6.91);
});

test("void restores a straight loss to zero and a pending play grades for the first time", () => {
  const plan = planCorrection("VOID", [
    play({ outcome: "LOSS", profitUnits: -1.5, units: 1.5 }),
    play({ outcome: "PENDING", profitUnits: null }),
  ]);
  assert.deepEqual(
    plan.straights.map((s) => [
      s.before.outcome,
      s.after.outcome,
      s.after.profitUnits,
    ]),
    [
      ["LOSS", "VOID", 0],
      ["PENDING", "VOID", 0],
    ],
  );
  assert.equal(plan.profitDelta, 1.5);
});

function ticket(
  legs: {
    id: string;
    outcome: CorrectionPlay["outcome"];
    oddsAmerican: number;
  }[],
  settled: { outcome: CorrectionPlay["outcome"]; profitUnits: number | null },
  units = 1,
) {
  return { id: `t-${legs[0]!.id}`, units, legs, ...settled };
}

test("voiding a losing leg re-settles the ticket on the surviving legs", () => {
  const legs = [
    { id: "L1", outcome: "LOSS" as const, oddsAmerican: 100 },
    { id: "L2", outcome: "WIN" as const, oddsAmerican: 100 },
    { id: "L3", outcome: "WIN" as const, oddsAmerican: 100 },
  ];
  const parlay = ticket(legs, { outcome: "LOSS", profitUnits: -1 });
  const plan = planCorrection("VOID", [
    play({ id: "L1", outcome: "LOSS", profitUnits: null, parlay }),
  ]);
  assert.equal(plan.straights.length, 0);
  const [entry] = plan.parlays;
  assert.ok(entry);
  // Two +100 winners: 2.0 × 2.0 = 4.0 decimal → +3U on a 1U stake, +300.
  assert.deepEqual(entry.after, { outcome: "WIN", profitUnits: 3 });
  assert.equal(entry.effectiveOddsAmerican, 300);
  assert.equal(entry.changed, true);
  assert.equal(plan.profitDelta, 4);
});

test("a leg change that leaves the ticket lost is still a change (and still audited)", () => {
  const legs = [
    { id: "A", outcome: "LOSS" as const, oddsAmerican: -110 },
    { id: "B", outcome: "LOSS" as const, oddsAmerican: -110 },
  ];
  const parlay = ticket(legs, { outcome: "LOSS", profitUnits: -1 });
  const plan = planCorrection("VOID", [
    play({ id: "A", outcome: "LOSS", profitUnits: null, parlay }),
  ]);
  assert.deepEqual(plan.parlays[0]!.after, {
    outcome: "LOSS",
    profitUnits: -1,
  });
  assert.equal(plan.parlays[0]!.changed, true);
  assert.equal(plan.changedPlayCount, 1);
  assert.equal(plan.profitDelta, 0);
});

test("an unfinished leg keeps the ticket pending after the correction", () => {
  const legs = [
    { id: "X", outcome: "LOSS" as const, oddsAmerican: 120 },
    { id: "Y", outcome: "PENDING" as const, oddsAmerican: 120 },
  ];
  const parlay = ticket(legs, { outcome: "LOSS", profitUnits: -1 });
  const plan = planCorrection("WIN", [
    play({ id: "X", outcome: "LOSS", profitUnits: null, parlay }),
  ]);
  assert.deepEqual(plan.parlays[0]!.after, {
    outcome: "PENDING",
    profitUnits: null,
  });
});

test("two targeted legs on one ticket settle that ticket once", () => {
  const legs = [
    { id: "P1", outcome: "LOSS" as const, oddsAmerican: 100 },
    { id: "P2", outcome: "LOSS" as const, oddsAmerican: 100 },
    { id: "P3", outcome: "WIN" as const, oddsAmerican: 150 },
  ];
  const parlay = ticket(legs, { outcome: "LOSS", profitUnits: -2 }, 2);
  const shared = { capperId: "owner", capperLabel: "@owner", parlay };
  const plan = planCorrection("VOID", [
    play({ id: "P1", outcome: "LOSS", profitUnits: null, ...shared }),
    play({ id: "P2", outcome: "LOSS", profitUnits: null, ...shared }),
  ]);
  assert.equal(plan.parlays.length, 1);
  assert.equal(plan.parlays[0]!.legChanges.length, 2);
  // Only P3 survives: +150 on 2U = +3U.
  assert.deepEqual(plan.parlays[0]!.after, { outcome: "WIN", profitUnits: 3 });
  assert.equal(plan.changedPlayCount, 2);
  assert.equal(plan.affectedCapperCount, 1);
});

test("the same play listed twice is planned once", () => {
  const p = play();
  const plan = planCorrection("VOID", [p, p]);
  assert.equal(plan.straights.length, 1);
  assert.equal(plan.changedPlayCount, 1);
  assert.equal(plan.unchangedPlayCount, 0);
});
