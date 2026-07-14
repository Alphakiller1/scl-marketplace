import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getOddsForBook,
  normalizeEventBoard,
  preferredThenAll,
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
