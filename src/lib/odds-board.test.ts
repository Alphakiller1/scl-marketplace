import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dedupeOddsEvents,
  getOddsForBook,
  isExtremeAmericanOdds,
  matchesBoardSelection,
  normalizeEventBoard,
  normalizeUpcomingEvent,
  preferredThenAll,
  resolveBoardBooks,
  type OddsEvent,
  type OddsSelection,
} from "@/lib/odds-board";
import { PICK_BOARD_BOOKS } from "@/lib/books";
import type { RawEventOdds } from "@/lib/odds-verify";

const EVENT: RawEventOdds = {
  id: "e1",
  bookmakers: [
    {
      key: "draftkings",
      markets: [
        {
          key: "spreads",
          outcomes: [{ name: "Lakers", price: -110, point: -3.5 }],
        },
        {
          key: "h2h",
          outcomes: [
            { name: "Lakers", price: -150 },
            { name: "Celtics", price: 130 },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      markets: [
        {
          key: "spreads",
          outcomes: [{ name: "Lakers", price: -105, point: -3.5 }],
        },
        {
          key: "h2h",
          outcomes: [
            { name: "Lakers", price: -145 },
            { name: "Celtics", price: 125 },
          ],
        },
      ],
    },
    {
      key: "betmgm",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Lakers", price: -140 },
            { name: "Celtics", price: 120 },
          ],
        },
      ],
    },
  ],
};

test("normalizeEventBoard attributes best price + book across all books", () => {
  const board = normalizeEventBoard(EVENT);
  const spread = board.find(
    (s) => s.market === "Spread" && s.side === "Lakers" && s.line === -3.5,
  );
  assert.ok(spread);
  assert.equal(spread!.oddsAmerican, -105);
  assert.equal(spread!.book, "fanduel");
  assert.equal(spread!.bookPrices?.draftkings, -110);
  assert.equal(spread!.bookPrices?.fanduel, -105);
});

test("normalizeEventBoard prefers capper books then falls back to remaining", () => {
  // Capper only selected DK — use DK price even though FD is better overall.
  const dkOnly = normalizeEventBoard(EVENT, { books: ["draftkings"] });
  const spreadDk = dkOnly.find(
    (s) => s.market === "Spread" && s.side === "Lakers",
  );
  assert.equal(spreadDk?.oddsAmerican, -110);
  assert.equal(spreadDk?.book, "draftkings");

  // Capper selected MGM only — MGM has no spread → fall back to remaining books.
  const mgmOnly = normalizeEventBoard(EVENT, { books: ["betmgm"] });
  const spreadMgm = mgmOnly.find(
    (s) => s.market === "Spread" && s.side === "Lakers",
  );
  assert.ok(spreadMgm);
  assert.equal(spreadMgm!.oddsAmerican, -105);
  assert.equal(spreadMgm!.book, "fanduel");

  // Empty books = Best among the pick-form five (FanDuel beats DraftKings here).
  const empty = normalizeEventBoard(EVENT, { books: [] });
  assert.equal(
    empty.find((s) => s.market === "Spread" && s.side === "Lakers")
      ?.oddsAmerican,
    -105,
  );
});

test("normalizeEventBoard Best ignores books outside the pick-form five", () => {
  const withBovada: RawEventOdds = {
    ...EVENT,
    bookmakers: [
      ...(EVENT.bookmakers ?? []),
      {
        key: "bovada",
        markets: [
          {
            key: "spreads",
            outcomes: [{ name: "Lakers", price: 120, point: -3.5 }],
          },
        ],
      },
    ],
  };
  const spread = normalizeEventBoard(withBovada).find(
    (s) => s.market === "Spread" && s.side === "Lakers",
  );
  assert.equal(spread?.oddsAmerican, -105);
  assert.equal(spread?.book, "fanduel");
  assert.equal(spread?.bookPrices?.bovada, undefined);
  assert.equal(spread?.bookPrices?.fanduel, -105);
});

test("getOddsForBook on selection is honest null (no silent substitute)", () => {
  const board = normalizeEventBoard(EVENT);
  const spread = board.find(
    (s) => s.market === "Spread" && s.side === "Lakers",
  )!;
  assert.equal(getOddsForBook(spread, "fanduel"), -105);
  assert.equal(getOddsForBook(spread, "draftkings"), -110);
  assert.equal(getOddsForBook(spread, "betmgm"), null);
});

// The board row here is Lakers -3.5, priced draftkings -110 / fanduel -105.
// Best available is -105 (decimal 1.952), so the 8% payout bound accepts any
// claim paying up to ~2.109 decimal (about +111) and refuses anything longer.
function lakersSpread() {
  const spread = normalizeEventBoard(EVENT).find(
    (selection) =>
      selection.market === "Spread" &&
      selection.side === "Lakers" &&
      selection.line === -3.5,
  );
  assert.ok(spread);
  return spread;
}

test("matchesBoardSelection confirms the exact market, line and side", () => {
  assert.equal(
    matchesBoardSelection(lakersSpread(), {
      market: "Spread",
      side: "Lakers",
      line: -3.5,
      oddsAmerican: -105,
      book: "fanduel",
    }),
    true,
  );
  assert.equal(
    matchesBoardSelection(lakersSpread(), {
      market: "Spread",
      side: "Lakers",
      line: -4.5,
      oddsAmerican: -105,
      book: "fanduel",
    }),
    false,
  );
  assert.equal(
    matchesBoardSelection(lakersSpread(), {
      market: "Spread",
      side: "Celtics",
      line: -3.5,
      oddsAmerican: -105,
      book: "fanduel",
    }),
    false,
  );
});

test("a price that drifted after capture still confirms", () => {
  // The whole point: the board refreshes under the capper while they build a
  // slip, and a parlay is all-or-nothing. Ordinary movement in either direction
  // is accepted — a shade better, and much worse.
  for (const oddsAmerican of [-104, -120, -130, -250, 100]) {
    assert.equal(
      matchesBoardSelection(lakersSpread(), {
        market: "Spread",
        side: "Lakers",
        line: -3.5,
        oddsAmerican,
        book: "fanduel",
      }),
      true,
      `expected ${oddsAmerican} to confirm`,
    );
  }
});

test("a price better than every covered book beyond tolerance is refused", () => {
  // The one-sided fraud bound survives: inflating the captured price is the only
  // way to inflate a record, and it is still caught.
  for (const oddsAmerican of [150, 250, 900]) {
    assert.equal(
      matchesBoardSelection(lakersSpread(), {
        market: "Spread",
        side: "Lakers",
        line: -3.5,
        oddsAmerican,
        book: "fanduel",
      }),
      false,
      `expected ${oddsAmerican} to be refused`,
    );
  }
});

test("a team total confirms against its own club, never the opponent's", () => {
  // Both clubs' rows carry the same market, side, line and (empty) player, so
  // the club in the selection text is the ONLY thing telling them apart.
  const brewers: OddsSelection = {
    label: "Milwaukee Brewers Over 2.5",
    market: "Team Total",
    selection: "Milwaukee Brewers Over 2.5",
    side: "Over",
    line: 2.5,
    oddsAmerican: -210,
    book: "draftkings",
    bookPrices: { draftkings: -210 },
  };
  const claim = {
    market: "Team Total",
    side: "Over",
    line: 2.5,
    oddsAmerican: -210,
    book: "draftkings",
  };

  assert.equal(
    matchesBoardSelection(brewers, {
      ...claim,
      selection: "Milwaukee Brewers Over 2.5",
    }),
    true,
  );
  assert.equal(
    matchesBoardSelection(brewers, {
      ...claim,
      selection: "Chicago Cubs Over 2.5",
    }),
    false,
  );
  // An unparseable or absent label is no weaker than before the club check.
  assert.equal(
    matchesBoardSelection(brewers, { ...claim, selection: "Brewers TT O2.5" }),
    true,
  );
  assert.equal(matchesBoardSelection(brewers, claim), true);
});

test("preferredThenAll falls back when preferred books miss the market", () => {
  const byBook = new Map([
    ["draftkings", -110],
    ["fanduel", -105],
  ]);
  const hit = preferredThenAll(byBook, ["draftkings"]);
  assert.equal(hit?.price, -110);
  assert.equal(hit?.book, "draftkings");

  const miss = preferredThenAll(byBook, ["betmgm"]);
  assert.equal(miss?.price, -105);
  assert.equal(miss?.book, "fanduel");
});

test("preferredThenAll can refuse to leave the pick-form five", () => {
  const byBook = new Map([
    ["bovada", 150],
    ["draftkings", -110],
  ]);
  const best = preferredThenAll(byBook, PICK_BOARD_BOOKS, undefined, {
    fallbackToAll: false,
  });
  assert.equal(best?.price, -110);
  assert.equal(best?.book, "draftkings");
  assert.equal(best?.bookPrices?.bovada, undefined);

  const none = preferredThenAll(byBook, ["betmgm"], undefined, {
    fallbackToAll: false,
  });
  assert.equal(none, null);
});

test("isExtremeAmericanOdds flags longshots and heavy favorites only", () => {
  assert.equal(isExtremeAmericanOdds(900), true);
  assert.equal(isExtremeAmericanOdds(940), true);
  assert.equal(isExtremeAmericanOdds(899), false);
  assert.equal(isExtremeAmericanOdds(-2000), true);
  assert.equal(isExtremeAmericanOdds(-3100), true);
  assert.equal(isExtremeAmericanOdds(-1999), false);
  assert.equal(isExtremeAmericanOdds(-110), false);
  assert.equal(isExtremeAmericanOdds(150), false);
});

test("dedupeOddsEvents keeps one row per sport matchup, preferring most-complete", () => {
  const thin: OddsEvent = {
    id: "thin",
    sport: "MLB",
    commenceTime: "2026-07-18T23:10:00Z",
    home: "Cleveland Guardians",
    away: "Pittsburgh Pirates",
    selections: [
      {
        label: "Pirates ML",
        market: "Moneyline",
        selection: "Pittsburgh Pirates",
        side: "Pittsburgh Pirates",
        featured: true,
        oddsAmerican: 940,
        book: "draftkings",
        bookPrices: { draftkings: 940 },
      },
    ],
  };
  const rich: OddsEvent = {
    id: "rich",
    sport: "MLB",
    commenceTime: "2026-07-18T23:10:00Z",
    home: "Cleveland Guardians",
    away: "Pittsburgh Pirates",
    selections: [
      {
        label: "Pirates ML",
        market: "Moneyline",
        selection: "Pittsburgh Pirates",
        side: "Pittsburgh Pirates",
        featured: true,
        oddsAmerican: 150,
        book: "fanduel",
        bookPrices: { draftkings: 145, fanduel: 150, betmgm: 140 },
      },
      {
        label: "Guardians ML",
        market: "Moneyline",
        selection: "Cleveland Guardians",
        side: "Cleveland Guardians",
        featured: true,
        oddsAmerican: -175,
        book: "fanduel",
        bookPrices: { draftkings: -170, fanduel: -175 },
      },
    ],
  };
  const other: OddsEvent = {
    id: "other",
    sport: "MLB",
    commenceTime: "2026-07-18T23:10:00Z",
    home: "New York Yankees",
    away: "Boston Red Sox",
    selections: thin.selections,
  };
  const otherSport: OddsEvent = {
    ...thin,
    id: "other-sport",
    sport: "NBA",
  };

  const deduped = dedupeOddsEvents([thin, rich, other, otherSport, thin]);
  assert.equal(deduped.length, 3);
  assert.equal(deduped[0]!.id, "rich");
  assert.equal(deduped[1]!.id, "other");
  assert.equal(deduped[2]!.id, "other-sport");
});

test("dedupeOddsEvents prefers the freshest row when completeness ties", () => {
  const stale: OddsEvent = {
    id: "stale",
    sport: "MLB",
    commenceTime: "2026-07-18T23:10:00Z",
    home: "Cleveland Guardians",
    away: "Pittsburgh Pirates",
    selections: [
      {
        label: "Pirates ML",
        market: "Moneyline",
        selection: "Pittsburgh Pirates",
        side: "Pittsburgh Pirates",
        oddsAmerican: 145,
        book: "draftkings",
        bookPrices: { draftkings: 145 },
        bookCapturedAt: { draftkings: "2026-07-18T18:00:00Z" },
        oddsCapturedAt: "2026-07-18T18:00:00Z",
      },
    ],
  };
  const fresh: OddsEvent = {
    ...stale,
    id: "fresh",
    selections: [
      {
        ...stale.selections[0]!,
        oddsAmerican: 150,
        bookPrices: { draftkings: 150 },
        bookCapturedAt: { draftkings: "2026-07-18T18:05:00Z" },
        oddsCapturedAt: "2026-07-18T18:05:00Z",
      },
    ],
  };

  assert.equal(dedupeOddsEvents([stale, fresh])[0]!.id, "fresh");
  assert.equal(dedupeOddsEvents([fresh, stale])[0]!.id, "fresh");
});

test("normalizeEventBoard attaches bookmaker last_update as oddsCapturedAt", () => {
  const withUpdate: RawEventOdds = {
    ...EVENT,
    bookmakers: EVENT.bookmakers?.map((bm) =>
      bm.key === "fanduel"
        ? { ...bm, last_update: "2026-07-18T18:00:00Z" }
        : bm,
    ),
  };
  const board = normalizeEventBoard(withUpdate);
  const spread = board.find(
    (s) => s.market === "Spread" && s.side === "Lakers",
  );
  assert.equal(spread?.book, "fanduel");
  assert.equal(spread?.oddsCapturedAt, "2026-07-18T18:00:00Z");
  assert.equal(spread?.bookCapturedAt?.fanduel, "2026-07-18T18:00:00Z");
});

test("alternate prop markets reach the board instead of being dropped", () => {
  // The milestone ladder lives ONLY under the _alternate key. It was requested
  // and billed, then discarded because the label lookup held featured keys only.
  const event = {
    id: "e1",
    sport_key: "baseball_mlb",
    commence_time: "2026-08-06T23:10:00Z",
    home_team: "Cincinnati Reds",
    away_team: "Athletics",
    bookmakers: [
      {
        key: "draftkings",
        last_update: "2026-08-06T21:00:00Z",
        markets: [
          {
            key: "pitcher_strikeouts",
            outcomes: [
              {
                name: "Over",
                description: "Hunter Greene",
                point: 5.5,
                price: -110,
              },
            ],
          },
          {
            key: "pitcher_strikeouts_alternate",
            outcomes: [
              {
                name: "Over",
                description: "Hunter Greene",
                point: 6.5,
                price: 145,
              },
              {
                name: "Over",
                description: "Hunter Greene",
                point: 7.5,
                price: 240,
              },
            ],
          },
        ],
      },
    ],
  };

  const board = normalizeEventBoard(
    event as Parameters<typeof normalizeEventBoard>[0],
  );
  const strikeouts = board.filter((s) => s.market === "Strikeouts");
  const lines = strikeouts
    .map((s) => s.line)
    .sort((a, b) => (a ?? 0) - (b ?? 0));

  // Featured line plus both milestone rungs, all under one label.
  assert.deepEqual(lines, [5.5, 6.5, 7.5]);
  assert.ok(strikeouts.every((s) => s.player === "Hunter Greene"));
});

test("MLB periods and props plus WNBA halves and props all reach selection rows", () => {
  const event: RawEventOdds = {
    id: "required-expanded-markets",
    bookmakers: [
      {
        key: "draftkings",
        markets: [
          {
            key: "alternate_totals_1st_7_innings",
            outcomes: [{ name: "Over", point: 6.5, price: -105 }],
          },
          {
            key: "batter_hits_alternate",
            outcomes: [
              {
                name: "Over",
                description: "Aaron Judge",
                point: 1.5,
                price: 145,
              },
            ],
          },
          {
            key: "batter_total_bases",
            outcomes: [
              {
                name: "Over",
                description: "Aaron Judge",
                point: 1.5,
                price: -115,
              },
            ],
          },
          {
            key: "alternate_spreads_h1",
            outcomes: [{ name: "Atlanta Dream", point: -2.5, price: 110 }],
          },
          {
            key: "player_points_alternate",
            outcomes: [
              {
                name: "Over",
                description: "Rhyne Howard",
                point: 24.5,
                price: 125,
              },
            ],
          },
        ],
      },
    ],
  };

  const board = normalizeEventBoard(event);
  assert.ok(
    board.some(
      (selection) =>
        selection.market === "1st 7 Innings Total" && selection.line === 6.5,
    ),
  );
  assert.ok(
    board.some(
      (selection) =>
        selection.market === "Total Bases" &&
        selection.player === "Aaron Judge" &&
        selection.line === 1.5,
    ),
  );
  assert.ok(
    board.some(
      (selection) =>
        selection.market === "Hits" &&
        selection.player === "Aaron Judge" &&
        selection.line === 1.5,
    ),
  );
  assert.ok(
    board.some(
      (selection) =>
        selection.market === "1st Half Spread" &&
        selection.side === "Atlanta Dream" &&
        selection.line === -2.5,
    ),
  );
  assert.ok(
    board.some(
      (selection) =>
        selection.market === "Points" &&
        selection.player === "Rhyne Howard" &&
        selection.line === 24.5,
    ),
  );
});

test("tennis Best keeps Bovada game spreads the pick-form five do not post", () => {
  assert.equal(resolveBoardBooks(undefined, "TENNIS").fallbackToAll, true);
  assert.equal(resolveBoardBooks(undefined, "MLB").fallbackToAll, false);

  const tennis: RawEventOdds = {
    id: "t1",
    bookmakers: [
      {
        key: "fanduel",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Ann Li", price: -180 },
              { name: "Maria Camila Osorio Serrano", price: 150 },
            ],
          },
        ],
      },
      {
        key: "bovada",
        markets: [
          {
            key: "h2h",
            outcomes: [
              { name: "Ann Li", price: -175 },
              { name: "Maria Camila Osorio Serrano", price: 145 },
            ],
          },
          {
            key: "spreads",
            outcomes: [
              { name: "Ann Li", price: -110, point: -3.5 },
              { name: "Maria Camila Osorio Serrano", price: -110, point: 3.5 },
            ],
          },
          {
            key: "totals",
            outcomes: [
              { name: "Over", price: -115, point: 21.5 },
              { name: "Under", price: -105, point: 21.5 },
            ],
          },
        ],
      },
    ],
  };

  const board = normalizeEventBoard(tennis, { sport: "TENNIS" });
  const spread = board.find(
    (s) => s.market === "Spread" && s.side === "Ann Li" && s.line === -3.5,
  );
  const total = board.find(
    (s) => s.market === "Total" && s.side === "Over" && s.line === 21.5,
  );
  assert.ok(spread);
  assert.equal(spread!.book, "bovada");
  assert.equal(spread!.oddsAmerican, -110);
  assert.ok(total);
  assert.equal(total!.book, "bovada");

  const surface = normalizeUpcomingEvent("TENNIS", {
    id: "t1",
    commence_time: "2026-08-24T18:00:00Z",
    home_team: "Maria Camila Osorio Serrano",
    away_team: "Ann Li",
    bookmakers: tennis.bookmakers,
  });
  assert.ok(
    surface.selections.some(
      (s) => s.market === "Spread" && s.side === "Ann Li" && s.line === -3.5,
    ),
  );
  assert.ok(
    surface.selections.some(
      (s) => s.market === "Total" && s.side === "Over" && s.line === 21.5,
    ),
  );
});

test("a soccer fixture keeps the market only a non-rail book priced", () => {
  assert.equal(resolveBoardBooks(undefined, "SOCCER").fallbackToAll, true);

  // The reported symptom, as the provider actually returns it: one fixture
  // where a rail book posted the 3-way moneyline and only Bovada posted the
  // total. The total was fetched under regions=us and billed, then dropped for
  // want of a rail price — so the match rendered moneyline-only.
  const moneylineOnlyRail = normalizeUpcomingEvent(
    "SOCCER",
    {
      id: "s1",
      commence_time: "2026-08-26T23:00:00Z",
      home_team: "Palmeiras",
      away_team: "Corinthians",
      bookmakers: [
        {
          key: "draftkings",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Palmeiras", price: -130 },
                { name: "Corinthians", price: 320 },
                { name: "Draw", price: 260 },
              ],
            },
          ],
        },
        {
          key: "bovada",
          markets: [
            {
              key: "totals",
              outcomes: [
                { name: "Over", price: -115, point: 2.5 },
                { name: "Under", price: -105, point: 2.5 },
              ],
            },
          ],
        },
      ],
    },
    undefined,
    "BRAZIL_SERIE_A",
  );

  const total = moneylineOnlyRail.selections.find(
    (s) => s.market === "Total" && s.side === "Over" && s.line === 2.5,
  );
  assert.ok(total, "the total priced only by a non-rail book was dropped");
  assert.equal(total!.book, "bovada");
  // The rail price still wins where the rail has one.
  const moneyline = moneylineOnlyRail.selections.find(
    (s) => s.market === "Moneyline" && s.side === "Palmeiras",
  );
  assert.equal(moneyline!.book, "draftkings");

  // ...and the mirror image, which is why the board looked inconsistent from
  // one fixture to the next: here no rail book posted the moneyline.
  const totalsOnlyRail = normalizeUpcomingEvent(
    "SOCCER",
    {
      id: "s2",
      commence_time: "2026-08-26T23:00:00Z",
      home_team: "Vejle",
      away_team: "Randers",
      bookmakers: [
        {
          key: "bovada",
          markets: [
            {
              key: "h2h",
              outcomes: [
                { name: "Vejle", price: 150 },
                { name: "Randers", price: 175 },
                { name: "Draw", price: 230 },
              ],
            },
          ],
        },
        {
          key: "fanduel",
          markets: [
            {
              key: "totals",
              outcomes: [
                { name: "Over", price: -120, point: 2.5 },
                { name: "Under", price: 100, point: 2.5 },
              ],
            },
          ],
        },
      ],
    },
    undefined,
    "DENMARK_SUPERLIGA",
  );
  assert.ok(
    totalsOnlyRail.selections.some(
      (s) => s.market === "Moneyline" && s.side === "Draw",
    ),
    "the moneyline priced only by a non-rail book was dropped",
  );

  // The rail still governs the US majors: nothing here widens those boards.
  assert.equal(resolveBoardBooks(undefined, "MLB").fallbackToAll, false);
  assert.equal(resolveBoardBooks(undefined, "NFL").fallbackToAll, false);
});
