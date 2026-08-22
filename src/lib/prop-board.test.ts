import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PROP_MARKET_PREVIEW,
  availablePropMarkets,
  countPropChips,
  filterPlayerPropGroups,
  groupPropsByPlayer,
  propMarketShortLabel,
  splitMarketPreview,
} from "./prop-board";

const slate = [
  { market: "Points", player: "Jayson Tatum", side: "Over", line: 27.5 },
  { market: "Points", player: "Jayson Tatum", side: "Under", line: 27.5 },
  { market: "Rebounds", player: "Jayson Tatum", side: "Over", line: 8.5 },
  { market: "Assists", player: "Jayson Tatum", side: "Over", line: 5.5 },
  { market: "3-Pointers", player: "Jayson Tatum", side: "Over", line: 3.5 },
  { market: "Points", player: "Jaylen Brown", side: "Over", line: 24.5 },
  { market: "Rebounds", player: "Jaylen Brown", side: "Over", line: 5.5 },
  { market: "Strikeouts", player: "Gerrit Cole", side: "Over", line: 6.5 },
  { market: "Hits", player: "Aaron Judge", side: "Over", line: 1.5 },
];

describe("propMarketShortLabel", () => {
  it("maps curated markets to compact pill labels", () => {
    assert.equal(propMarketShortLabel("Points"), "Pts");
    assert.equal(propMarketShortLabel("Rebounds"), "Reb");
    assert.equal(propMarketShortLabel("Assists"), "Ast");
    assert.equal(propMarketShortLabel("3-Pointers"), "3PM");
    assert.equal(propMarketShortLabel("Strikeouts"), "Ks");
    assert.equal(propMarketShortLabel("Hits"), "Hits");
    assert.equal(propMarketShortLabel("Total Bases"), "TB");
    assert.equal(propMarketShortLabel("Hits+Runs+RBIs"), "H+R+RBI");
  });

  it("falls back to the full label for unknown markets", () => {
    assert.equal(propMarketShortLabel("Batting Average"), "Batting Average");
  });
});

describe("availablePropMarkets", () => {
  it("returns sorted unique market labels from the slate", () => {
    assert.deepEqual(availablePropMarkets(slate), [
      "3-Pointers",
      "Assists",
      "Hits",
      "Points",
      "Rebounds",
      "Strikeouts",
    ]);
  });
});

describe("groupPropsByPlayer", () => {
  it("groups by player then market and sorts players alphabetically", () => {
    const groups = groupPropsByPlayer(slate);
    assert.deepEqual(
      groups.map((g) => g.player),
      ["Aaron Judge", "Gerrit Cole", "Jaylen Brown", "Jayson Tatum"],
    );
    const tatum = groups.find((g) => g.player === "Jayson Tatum")!;
    assert.deepEqual(
      tatum.markets.map(([m]) => m),
      ["3-Pointers", "Assists", "Points", "Rebounds"],
    );
    assert.equal(tatum.markets.find(([m]) => m === "Points")![1].length, 2);
  });

  it("skips selections without a player", () => {
    assert.deepEqual(
      groupPropsByPlayer([{ market: "Points", player: "  " }]),
      [],
    );
  });
});

describe("filterPlayerPropGroups", () => {
  const groups = groupPropsByPlayer(slate);

  it("filters by player query (case-insensitive substring)", () => {
    const hit = filterPlayerPropGroups(groups, { query: "tatum" });
    assert.equal(hit.length, 1);
    assert.equal(hit[0]!.player, "Jayson Tatum");
  });

  it("filters by market category and drops players without that market", () => {
    const hit = filterPlayerPropGroups(groups, { market: "Strikeouts" });
    assert.equal(hit.length, 1);
    assert.equal(hit[0]!.player, "Gerrit Cole");
    assert.equal(hit[0]!.markets.length, 1);
  });

  it("combines query + market", () => {
    const hit = filterPlayerPropGroups(groups, {
      query: "jay",
      market: "Rebounds",
    });
    assert.deepEqual(
      hit.map((g) => g.player),
      ["Jaylen Brown", "Jayson Tatum"],
    );
    for (const g of hit) {
      assert.deepEqual(
        g.markets.map(([m]) => m),
        ["Rebounds"],
      );
    }
  });
});

describe("splitMarketPreview", () => {
  it("returns all markets when at or under the preview limit", () => {
    const markets: [string, number[]][] = [
      ["Points", [1]],
      ["Rebounds", [2]],
    ];
    const { preview, remaining } = splitMarketPreview(markets, 3);
    assert.equal(preview.length, 2);
    assert.equal(remaining, 0);
  });

  it("caps preview at PROP_MARKET_PREVIEW and reports remaining", () => {
    const markets: [string, number[]][] = [
      ["3-Pointers", [1]],
      ["Assists", [2]],
      ["Points", [3]],
      ["Rebounds", [4]],
    ];
    const { preview, remaining } = splitMarketPreview(markets);
    assert.equal(PROP_MARKET_PREVIEW, 3);
    assert.deepEqual(
      preview.map(([m]) => m),
      ["3-Pointers", "Assists", "Points"],
    );
    assert.equal(remaining, 1);
  });
});

describe("countPropChips", () => {
  it("sums selection counts across markets", () => {
    const groups = groupPropsByPlayer(slate);
    const tatum = groups.find((g) => g.player === "Jayson Tatum")!;
    assert.equal(countPropChips(tatum.markets), 5);
  });
});
