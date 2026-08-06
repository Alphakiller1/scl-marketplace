import assert from "node:assert/strict";
import { test } from "node:test";

import {
  dedupeOddsEvents,
  getOddsForBook,
  isExtremeAmericanOdds,
  normalizeEventBoard,
  preferredThenAll,
  type OddsEvent,
} from "@/lib/odds-board";
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

  // Empty books = all-books best (today's regions=us behavior).
  const empty = normalizeEventBoard(EVENT, { books: [] });
  assert.equal(
    empty.find((s) => s.market === "Spread" && s.side === "Lakers")
      ?.oddsAmerican,
    -105,
  );
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
