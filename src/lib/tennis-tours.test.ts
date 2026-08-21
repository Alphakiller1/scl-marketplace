import assert from "node:assert/strict";
import { test } from "node:test";

import {
  TENNIS_CANDIDATE_LIMIT,
  TENNIS_TOUR_LIMIT,
  selectTennisTours,
  selectTennisToursWithFixtures,
  tennisTourByKey,
  tennisTourKey,
} from "@/lib/tennis-tours";

/** Shaped like a real `/v4/sports` payload during Cincinnati week. */
const CATALOG = [
  { key: "baseball_mlb", group: "Baseball", title: "MLB", active: true },
  {
    key: "tennis_wta_cincinnati_open",
    group: "Tennis",
    title: "WTA Cincinnati Open",
    active: true,
  },
  {
    key: "tennis_atp_cincinnati_open",
    group: "Tennis",
    title: "ATP Cincinnati Open",
    active: true,
  },
  {
    key: "tennis_atp_us_open",
    group: "Tennis",
    title: "ATP US Open",
    active: false,
  },
  {
    key: "tennis_atp_winner",
    group: "Tennis",
    title: "ATP Tournament Winner",
    active: true,
    has_outrights: true,
  },
];

test("selects in-season tournaments, ATP before WTA", () => {
  const tours = selectTennisTours(CATALOG);
  assert.deepEqual(
    tours.map((t) => t.oddsApiKey),
    ["tennis_atp_cincinnati_open", "tennis_wta_cincinnati_open"],
  );
  assert.equal(tours[0]!.key, "ATP_CINCINNATI_OPEN");
  assert.equal(tours[0]!.label, "ATP Cincinnati Open");
});

test("skips out-of-season tours and futures-only markets", () => {
  const keys = selectTennisTours(CATALOG).map((t) => t.oddsApiKey);
  // Out of season: the key exists year-round but prices nothing in August.
  assert.ok(!keys.includes("tennis_atp_us_open"));
  // `has_outrights` is the tournament winner — billable, and no match lines,
  // so a capper could not log anything off it.
  assert.ok(!keys.includes("tennis_atp_winner"));
});

test("ignores non-tennis rows", () => {
  assert.ok(!selectTennisTours(CATALOG).some((t) => t.key === "MLB"));
});

test("honours the fetch budget", () => {
  assert.equal(selectTennisTours(CATALOG, 1).length, 1);
  assert.equal(selectTennisTours(CATALOG, 0).length, 0);
  assert.ok(selectTennisTours(CATALOG).length <= TENNIS_TOUR_LIMIT);
});

test("a league tag round-trips back to its sport key", () => {
  // This is what lets a pick verify weeks after the tour has moved on and the
  // catalog no longer names the tournament it was logged against.
  const tour = selectTennisTours(CATALOG)[0]!;
  assert.equal(tennisTourByKey(tour.key)?.oddsApiKey, tour.oddsApiKey);
  assert.equal(
    tennisTourKey("tennis_atp_cincinnati_open"),
    "ATP_CINCINNATI_OPEN",
  );
});

test("rejects a tag that is not a league key", () => {
  assert.equal(tennisTourByKey(""), undefined);
  assert.equal(tennisTourByKey("  "), undefined);
  assert.equal(tennisTourByKey("ATP Cincinnati"), undefined);
});

test("fixture ranking keeps Cincinnati when the US Open is already listed", () => {
  const now = Date.parse("2026-08-21T16:00:00Z");
  const catalog = [
    {
      key: "tennis_atp_us_open",
      group: "Tennis",
      title: "ATP US Open",
      active: true,
    },
    {
      key: "tennis_wta_us_open",
      group: "Tennis",
      title: "WTA US Open",
      active: true,
    },
    {
      key: "tennis_atp_cincinnati_open",
      group: "Tennis",
      title: "ATP Cincinnati Open",
      active: true,
    },
    {
      key: "tennis_wta_cincinnati_open",
      group: "Tennis",
      title: "WTA Cincinnati Open",
      active: true,
    },
    {
      key: "tennis_atp_winston_salem",
      group: "Tennis",
      title: "ATP Winston-Salem",
      active: true,
    },
  ];
  const candidates = selectTennisTours(catalog, TENNIS_CANDIDATE_LIMIT);
  const windows = new Map([
    [
      "tennis_atp_cincinnati_open",
      { upcoming: 8, firstKickoffMs: Date.parse("2026-08-21T19:00:00Z") },
    ],
    [
      "tennis_wta_cincinnati_open",
      { upcoming: 6, firstKickoffMs: Date.parse("2026-08-21T17:00:00Z") },
    ],
    [
      "tennis_atp_winston_salem",
      { upcoming: 4, firstKickoffMs: Date.parse("2026-08-21T18:00:00Z") },
    ],
    ["tennis_atp_us_open", { upcoming: 0, firstKickoffMs: null }],
    ["tennis_wta_us_open", { upcoming: 0, firstKickoffMs: null }],
  ]);
  const tours = selectTennisToursWithFixtures(
    candidates,
    windows,
    TENNIS_TOUR_LIMIT,
    now,
  );
  assert.ok(
    tours.some((tour) => tour.oddsApiKey === "tennis_atp_cincinnati_open"),
    "ATP Cincinnati must keep a paid slot while it still has matches",
  );
  assert.equal(tours[0]!.oddsApiKey, "tennis_atp_cincinnati_open");
  assert.ok(tours.length <= TENNIS_TOUR_LIMIT);
});
