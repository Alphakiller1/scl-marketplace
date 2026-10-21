import assert from "node:assert/strict";
import test from "node:test";

import {
  espnDraftKingsPropRows,
  rowsForPlayersMissingFromBoard,
  teamNameMatches,
  type EspnPropItem,
} from "@/lib/espn-draftkings-props";
import type { OddsSelection } from "@/lib/odds-board";

const SMART = "2990992";
const DURANT = "3202";
const names = new Map([
  [SMART, "Marcus Smart"],
  [DURANT, "Kevin Durant"],
]);

function item(
  athlete: string,
  type: string,
  value: number,
  american: string,
  displayValue = String(value),
): EspnPropItem {
  return {
    athlete: {
      $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/athletes/${athlete}?lang=en`,
    },
    type: { name: type },
    odds: { american: { value: american } },
    current: { target: { value, displayValue } },
    lastUpdated: "2026-10-21T05:07Z",
  };
}

// Marcus Smart on the 2026-10-21 Mavericks-Rockets DraftKings card, as ESPN
// listed it: the pair in Over-then-Under order, then the milestone ladder.
const smartCard: EspnPropItem[] = [
  item(SMART, "Total Points", 6.5, "-119"),
  item(SMART, "Total Points", 6.5, "-107"),
  item(SMART, "Points Milestones", 6, "-170", "6+"),
  item(SMART, "Points Milestones", 7, "-120", "7+"),
  item(SMART, "Points Milestones", 8, "+116", "8+"),
  item(SMART, "Total Points and Assists", 9.5, "-115"),
  item(SMART, "Total Points and Assists", 9.5, "-110"),
];

test("an ESPN pair is the Over then the Under on the board's labels", () => {
  const rows = espnDraftKingsPropRows(smartCard, names);
  const points = rows.filter((row) => row.market === "Points");
  const over = points.find((row) => row.side === "Over" && row.line === 6.5)!;
  const under = points.find((row) => row.side === "Under" && row.line === 6.5)!;
  assert.equal(over.oddsAmerican, -119);
  assert.equal(under.oddsAmerican, -107);
  assert.equal(over.selection, "Marcus Smart Over 6.5");
  assert.equal(over.player, "Marcus Smart");
  assert.deepEqual(over.bookPrices, { draftkings: -119 });
  assert.equal(over.book, "draftkings");
  assert.ok(rows.some((row) => row.market === "Pts+Ast" && row.line === 9.5));
});

test("an N+ milestone is the Over on the half-point below", () => {
  const rows = espnDraftKingsPropRows(smartCard, names);
  const ladder = rows
    .filter((row) => row.market === "Points" && row.side === "Over")
    .map((row) => [row.line, row.oddsAmerican]);
  // 6+ sits on 5.5, 7+ on the 6.5 the pair already prices (pair wins), 8+ on 7.5.
  assert.deepEqual(ladder, [
    [6.5, -119],
    [5.5, -170],
    [7.5, 116],
  ]);
});

test("a total that is not exactly a pair is dropped, never guessed", () => {
  const rows = espnDraftKingsPropRows(
    [item(SMART, "Total Assists", 2.5, "-111")],
    names,
  );
  assert.equal(rows.length, 0);
});

test("unknown athletes, period ladders and unpriced rows are skipped", () => {
  const rows = espnDraftKingsPropRows(
    [
      item("999", "Total Points", 10.5, "-110"),
      item("999", "Total Points", 10.5, "-110"),
      item(SMART, "Assists Milestones - 1st Quarter", 1, "+150", "1+"),
      item(SMART, "Total Steals and Blocks", 1.5, "-110"),
      item(SMART, "Total Steals and Blocks", 1.5, "-110"),
      { ...item(SMART, "Rebounds Milestones", 4, "", "4+") },
    ],
    names,
  );
  assert.equal(rows.length, 0);
});

test("only players with no row on the board are filled", () => {
  const board: OddsSelection[] = [
    {
      label: "Kevin Durant Over 23.5",
      market: "Points",
      selection: "Kevin Durant Over 23.5",
      side: "Over",
      line: 23.5,
      player: "Kevin Durant",
      oddsAmerican: -116,
      book: "draftkings",
      bookPrices: { draftkings: -116 },
    },
  ];
  const espn = espnDraftKingsPropRows(
    [
      ...smartCard,
      item(DURANT, "Total Rebounds", 5.5, "+120"),
      item(DURANT, "Total Rebounds", 5.5, "-158"),
    ],
    names,
  );
  const missing = rowsForPlayersMissingFromBoard(board, espn);
  assert.ok(missing.length > 0);
  assert.ok(missing.every((row) => row.player === "Marcus Smart"));
});

test("a suffix spelled differently is still the same player", () => {
  const board = [
    { player: "Jabari Smith Jr", market: "Points" } as OddsSelection,
  ];
  const rows = [
    { player: "Jabari Smith Jr.", market: "Points" } as OddsSelection,
  ];
  assert.equal(rowsForPlayersMissingFromBoard(board, rows).length, 0);
});

test("initials and short first names are the same player", () => {
  // The four duplicates the first live pass wrote on 2026-10-21.
  const pairs: [string, string][] = [
    ["A.J. Green", "AJ Green"],
    ["C.J. McCollum", "CJ McCollum"],
    ["R.J. Barrett", "RJ Barrett"],
    ["Herb Jones", "Herbert Jones"],
  ];
  for (const [provider, espn] of pairs) {
    const board = [{ player: provider, market: "Points" } as OddsSelection];
    const rows = [{ player: espn, market: "Points" } as OddsSelection];
    assert.equal(
      rowsForPlayersMissingFromBoard(board, rows).length,
      0,
      `${espn} duplicated ${provider}`,
    );
  }
  // A genuinely absent player is still filled.
  const board = [{ player: "Kevin Durant", market: "Points" } as OddsSelection];
  const smart = [{ player: "Marcus Smart", market: "Points" } as OddsSelection];
  assert.equal(rowsForPlayersMissingFromBoard(board, smart).length, 1);
});

test("provider team names match ESPN nicknames", () => {
  assert.ok(teamNameMatches("Los Angeles Clippers", "Clippers"));
  assert.ok(teamNameMatches("Portland Trail Blazers", "Trail Blazers"));
  assert.ok(teamNameMatches("Houston Rockets", "Rockets"));
  assert.ok(!teamNameMatches("Houston Rockets", "Mavericks"));
  assert.ok(!teamNameMatches("Houston Rockets", ""));
});
