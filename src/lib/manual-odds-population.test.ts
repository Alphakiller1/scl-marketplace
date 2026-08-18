import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent } from "@/lib/odds-board";
import {
  mergeLastGoodBoardEvents,
  parseExpandedSlateDays,
  selectExpandedSlateEvents,
} from "@/lib/manual-odds-population";

const NOW = new Date("2026-08-18T06:00:00.000Z");

function event(id: string, commenceTime: string): OddsEvent {
  return {
    id,
    sport: "MLB",
    commenceTime,
    home: `${id} home`,
    away: `${id} away`,
    selections: [
      {
        label: `${id} home`,
        market: "Moneyline",
        selection: `${id} home`,
        side: `${id} home`,
        featured: true,
        oddsAmerican: -110,
        book: "draftkings",
      },
    ],
  };
}

test("expanded warming can target tomorrow without spending on later games", () => {
  const rows = [
    event("today", "2026-08-18T23:00:00.000Z"),
    event("tomorrow", "2026-08-19T23:00:00.000Z"),
    event("later", "2026-08-20T23:00:00.000Z"),
  ];
  assert.deepEqual(
    selectExpandedSlateEvents(rows, ["tomorrow"], NOW).map((row) => row.id),
    ["tomorrow"],
  );
});

test("expanded day input accepts only the supported ET windows", () => {
  assert.deepEqual(
    parseExpandedSlateDays(" tomorrow, today, tomorrow,weekend "),
    ["tomorrow", "today"],
  );
});

test("a partial refresh retains future last-good fixtures", () => {
  const fresh = [event("fresh", "2026-08-19T23:00:00.000Z")];
  const prior = [
    event("fresh", "2026-08-19T22:00:00.000Z"),
    event("retained", "2026-08-19T21:00:00.000Z"),
    event("started", "2026-08-18T05:00:00.000Z"),
  ];
  const merged = mergeLastGoodBoardEvents(fresh, prior, NOW);
  assert.deepEqual(
    merged.map((row) => row.id),
    ["retained", "fresh"],
  );
  assert.equal(
    merged.find((row) => row.id === "fresh")?.commenceTime,
    fresh[0]?.commenceTime,
  );
});
