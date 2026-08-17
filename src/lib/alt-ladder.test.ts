import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ALT_LINE_CAP, sortAltLadder, splitAltLadder } from "@/lib/alt-ladder";
import { TEAM_TOTAL_LABEL } from "@/lib/team-total-markets";

type Rung = { market: string; line?: number; side: string; team?: string };

/** The ladder a book prices per club, in the ascending order the feed yields. */
function teamTotalLadder(lines: number[], teams = ["Reds", "Cubs"]): Rung[] {
  const rungs: Rung[] = [];
  for (const side of ["Over", "Under"]) {
    for (const line of lines) {
      for (const team of teams) {
        rungs.push({ market: TEAM_TOTAL_LABEL, line, side, team });
      }
    }
  }
  return rungs;
}

describe("sortAltLadder", () => {
  it("orders a spread ladder by proximity to the main line", () => {
    const opts = [
      { market: "Spread", line: -1.5 },
      { market: "Spread", line: -7.5 },
      { market: "Spread", line: -3.5 },
    ];
    assert.deepEqual(
      sortAltLadder("Spread", opts, -3.5).map((s) => s.line),
      [-3.5, -1.5, -7.5],
    );
  });

  it("falls back to ascending when the market has no main line", () => {
    const opts = [
      { market: "1st 5 Innings Total", line: 5.5 },
      { market: "1st 5 Innings Total", line: 4.5 },
      { market: "1st 5 Innings Total", line: 6.5 },
    ];
    assert.deepEqual(
      sortAltLadder("1st 5 Innings Total", opts).map((s) => s.line),
      [4.5, 5.5, 6.5],
    );
  });

  it("leads a team-total ladder with the pinned rung", () => {
    const sorted = sortAltLadder(
      TEAM_TOTAL_LABEL,
      teamTotalLadder([0.5, 1.5, 2.5, 3.5]),
    );
    assert.deepEqual(
      sorted.slice(0, 4).map((s) => s.line),
      [2.5, 2.5, 2.5, 2.5],
    );
  });

  it("keeps both sides of the pinned rung, for both clubs", () => {
    const sorted = sortAltLadder(
      TEAM_TOTAL_LABEL,
      teamTotalLadder([0.5, 1.5, 2.5, 3.5]),
    );
    assert.deepEqual(
      sorted
        .filter((s) => s.line === 2.5)
        .map((s) => `${s.team} ${s.side}`)
        .sort(),
      ["Cubs Over", "Cubs Under", "Reds Over", "Reds Under"],
    );
  });

  // The pin is a line value, not a sport: a game total of 2.5 is a different
  // market and must keep its own proximity order.
  it("does not pin 2.5 on a market that is not a team total", () => {
    const opts = [
      { market: "Total", line: 2.5 },
      { market: "Total", line: 8.5 },
    ];
    assert.deepEqual(
      sortAltLadder("Total", opts, 8.5).map((s) => s.line),
      [8.5, 2.5],
    );
  });

  it("does not invent the rung where no book prices it", () => {
    const sorted = sortAltLadder(
      TEAM_TOTAL_LABEL,
      teamTotalLadder([3.5, 4.5, 5.5]),
    );
    assert.equal(
      sorted.some((s) => s.line === 2.5),
      false,
    );
    assert.deepEqual(sorted[0]?.line, 3.5);
  });
});

describe("splitAltLadder", () => {
  // The regression itself: 0.5 and 1.5 for two clubs are exactly eight chips,
  // so before the pin the collapsed board cut the ladder immediately above the
  // rung cappers ask for by name.
  it("shows the pinned team total in the collapsed view", () => {
    const { visible, total, hidden } = splitAltLadder(
      TEAM_TOTAL_LABEL,
      teamTotalLadder([0.5, 1.5, 2.5, 3.5, 4.5, 5.5]),
    );
    assert.equal(visible.length, ALT_LINE_CAP);
    assert.equal(total, 24);
    assert.equal(hidden, 24 - ALT_LINE_CAP);
    assert.equal(
      visible.filter((s) => s.line === 2.5).length,
      4,
      "both sides, both clubs, without expanding",
    );
  });

  it("shows every rung once expanded", () => {
    const opts = teamTotalLadder([0.5, 1.5, 2.5, 3.5, 4.5, 5.5]);
    const { visible, hidden } = splitAltLadder(TEAM_TOTAL_LABEL, opts, {
      expanded: true,
    });
    assert.equal(visible.length, opts.length);
    assert.equal(hidden, 0);
  });

  it("reports nothing hidden when the ladder fits", () => {
    const { visible, total, hidden } = splitAltLadder(
      "Spread",
      [
        { market: "Spread", line: -1.5 },
        { market: "Spread", line: -2.5 },
      ],
      { mainLine: -1.5 },
    );
    assert.equal(visible.length, 2);
    assert.equal(total, 2);
    assert.equal(hidden, 0);
  });
});
