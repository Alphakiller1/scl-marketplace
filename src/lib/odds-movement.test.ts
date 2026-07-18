import assert from "node:assert/strict";
import { test } from "node:test";

import {
  americanToDecimal,
  combineDecimalOdds,
  decimalToAmerican,
} from "@/lib/odds";
import * as OddsMovement from "@/lib/odds-movement";
import {
  classifyOddsMove,
  moveKey,
  resolveCaptureOdds,
} from "@/lib/odds-movement";
import type { AcceptedMove } from "@/lib/odds-movement";
import {
  DEFAULT_TOLERANCE_PROB,
  impliedProbFromAmerican,
  liveLineAmerican,
  type RawEventOdds,
} from "@/lib/odds-verify";

const event: RawEventOdds = {
  id: "evt1",
  bookmakers: [
    {
      key: "draftkings",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Team A", price: -110 },
            { name: "Team B", price: -110 },
          ],
        },
      ],
    },
    {
      key: "fanduel",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Team A", price: -125 },
            { name: "Team B", price: 105 },
          ],
        },
      ],
    },
  ],
};

test("moveKey is price-independent", () => {
  assert.equal(
    moveKey({
      eventId: "e1",
      market: "Moneyline",
      side: "Team A",
    }),
    moveKey({
      eventId: "e1",
      market: "Moneyline",
      side: "Team A",
    }),
  );
});

test("classifyOddsMove: unchanged when live equals selected", () => {
  const a = classifyOddsMove({ selectedAmerican: -110, liveAmerican: -110 });
  assert.equal(a.class, "unchanged");
});

test("classifyOddsMove: unavailable when live is null", () => {
  const a = classifyOddsMove({ selectedAmerican: -110, liveAmerican: null });
  assert.equal(a.class, "unavailable");
  assert.equal(a.updatedOddsAmerican, null);
});

test("classifyOddsMove: favorable when live is better for the bettor", () => {
  // -105 is better than -110 (lower implied)
  const a = classifyOddsMove({ selectedAmerican: -110, liveAmerican: -105 });
  assert.equal(a.class, "favorable");
  assert.ok(impliedProbFromAmerican(-105) < impliedProbFromAmerican(-110));
});

test("classifyOddsMove: minor adverse within C3 tolerance auto-class", () => {
  // Tiny adverse move in implied space
  const selected = -110;
  const live = -112;
  const delta = Math.abs(
    impliedProbFromAmerican(live) - impliedProbFromAmerican(selected),
  );
  assert.ok(delta <= DEFAULT_TOLERANCE_PROB);
  const a = classifyOddsMove({
    selectedAmerican: selected,
    liveAmerican: live,
  });
  assert.equal(a.class, "minor");
});

test("classifyOddsMove: changed when adverse beyond tolerance", () => {
  const a = classifyOddsMove({ selectedAmerican: -110, liveAmerican: -150 });
  assert.equal(a.class, "changed");
  assert.equal(a.updatedOddsAmerican, -150);
});

test("resolveCaptureOdds: unchanged is ready and does not mark moved-accepted", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -110,
    moveKey: "k",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "ready");
  if (r.status === "ready") {
    assert.equal(r.oddsAmerican, -110);
    assert.equal(r.selectedOddsAmerican, -110);
    assert.equal(r.oddsMovedAccepted, false);
  }
});

test("resolveCaptureOdds: changed without acceptance → needs_confirm (no write path)", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -150,
    moveKey: "k1",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    book: "fanduel",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "needs_confirm");
  if (r.status === "needs_confirm") {
    assert.equal(r.moved.selectedOddsAmerican, -110);
    assert.equal(r.moved.updatedOddsAmerican, -150);
    assert.equal(r.moved.book, "fanduel");
    assert.equal(r.moved.verifiedAt, "2026-07-14T21:00:00.000Z");
  }
});

test("resolveCaptureOdds: accepted move persists live odds and sets oddsMovedAccepted", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -150,
    acceptedMoves: [
      {
        moveKey: "k1",
        selectedOddsAmerican: -110,
        acceptedOddsAmerican: -150,
      },
    ],
    moveKey: "k1",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "ready");
  if (r.status === "ready") {
    assert.equal(r.oddsAmerican, -150);
    assert.equal(r.selectedOddsAmerican, -110);
    assert.equal(r.oddsMovedAccepted, true);
    assert.match(r.moveNote ?? "", /LINE MOVED/);
  }
});

test("resolveCaptureOdds: stale acceptance that no longer matches live re-prompts", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -160,
    acceptedMoves: [
      {
        moveKey: "k1",
        selectedOddsAmerican: -110,
        acceptedOddsAmerican: -150, // outdated
      },
    ],
    moveKey: "k1",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "needs_confirm");
});

test("resolveCaptureOdds: unavailable blocks (never ready)", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: null,
    moveKey: "k1",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "unavailable");
});

test("resolveCaptureOdds: favorable auto-persists improved live odds", () => {
  const r = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -105,
    moveKey: "k1",
    eventId: "e",
    eventLabel: "A @ B",
    market: "Moneyline",
    selection: "Team A",
    side: "Team A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r.status, "ready");
  if (r.status === "ready") {
    assert.equal(r.oddsAmerican, -105);
    assert.equal(r.oddsMovedAccepted, false);
    assert.match(r.moveNote ?? "", /IMPROVED/);
  }
});

test("liveLineAmerican: book-scoped honest null when suspended", () => {
  const suspended: RawEventOdds = {
    id: "evt1",
    bookmakers: [
      {
        key: "draftkings",
        markets: [
          {
            key: "h2h",
            outcomes: [{ name: "Team B", price: -110 }],
          },
        ],
      },
    ],
  };
  assert.equal(
    liveLineAmerican(suspended, {
      marketKeys: ["h2h"],
      side: "Team A",
      bookKey: "draftkings",
    }),
    null,
  );
});

test("liveLineAmerican: returns capture-book price when present", () => {
  assert.equal(
    liveLineAmerican(event, {
      marketKeys: ["h2h"],
      side: "Team A",
      bookKey: "fanduel",
    }),
    -125,
  );
});

test("parlay combined odds use accepted (live) leg prices — math proof", () => {
  // Selected stale: -110 + -110; accepted live: -150 + -110
  // Combined must use -150 and -110, not the stale pair.
  const stale = decimalToAmerican(
    combineDecimalOdds([-110, -110].map(americanToDecimal)),
  );
  const accepted = decimalToAmerican(
    combineDecimalOdds([-150, -110].map(americanToDecimal)),
  );
  assert.notEqual(stale, accepted);
  const r1 = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -150,
    acceptedMoves: [
      { moveKey: "a", selectedOddsAmerican: -110, acceptedOddsAmerican: -150 },
    ],
    moveKey: "a",
    eventId: "e1",
    eventLabel: "A",
    market: "Moneyline",
    selection: "A",
    side: "A",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  const r2 = resolveCaptureOdds({
    selectedAmerican: -110,
    liveAmerican: -110,
    moveKey: "b",
    eventId: "e2",
    eventLabel: "B",
    market: "Moneyline",
    selection: "B",
    side: "B",
    verifiedAt: new Date("2026-07-14T21:00:00.000Z"),
  });
  assert.equal(r1.status, "ready");
  assert.equal(r2.status, "ready");
  if (r1.status === "ready" && r2.status === "ready") {
    const combined = decimalToAmerican(
      combineDecimalOdds(
        [r1.oddsAmerican, r2.oddsAmerican].map(americanToDecimal),
      ),
    );
    assert.equal(combined, accepted);
  }
});

test("AcceptedMove is type-only — no runtime export (picks/new smoke)", () => {
  // Regression: `import { AcceptedMove }` (value) → ReferenceError in client bundles.
  // Consumers must use `import type { AcceptedMove }`.
  assert.equal("AcceptedMove" in OddsMovement, false);
  assert.equal(typeof OddsMovement.findAcceptedMove, "function");
  const sample: AcceptedMove = {
    moveKey: "a|b||c|",
    selectedOddsAmerican: -110,
    acceptedOddsAmerican: -105,
  };
  assert.equal(sample.acceptedOddsAmerican, -105);
});
