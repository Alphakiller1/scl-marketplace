import assert from "node:assert/strict";
import test from "node:test";

import type { OddsEvent } from "@/lib/odds-board";
import { expandedBoardMarkets } from "@/lib/odds-verify";
import { ODDS_CONTROL_SPORTS } from "@/lib/odds-control";
import {
  DEFAULT_EVENT_BUYS_PER_DAY,
  HARD_MAX_EVENT_BUYS_PER_DAY,
} from "@/lib/odds-event-buy-budget";
import {
  shouldSpendExpandedBuy,
  withinExpandedBuyWindow,
  DEFAULT_EXPANDED_SPORT_ORDER,
  CATALOG_WORTH_READING_MARKETS,
  DEFAULT_EXPANDED_MAX_AGE_MINUTES,
  EVENT_MARKET_CATALOG_CREDIT_COST,
  canSkipExpandedEvent,
  eventMarketCatalogKeys,
  expandedCatchUpRunAt,
  EXPANDED_CATCHUP_MINUTES,
  EXPANDED_CATCHUP_MIN_GAP_MINUTES,
  expandedEventCreditCost,
  expandsFullSlate,
  intersectExpandedMarkets,
  laterExpandedCreditReserve,
  mergeLastGoodBoardEvents,
  parseExpandedMaxAgeMinutes,
  parseExpandedSlateDays,
  parseExpandedSportOrder,
  selectExpandedSlateEvents,
  shouldHoldCreditsForLater,
  staleSurfaceSports,
  surfaceRefreshReachedProvider,
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

test("expanded order includes NCAAF and ignores sports without event markets", () => {
  // This list is the gate as well as the order: a sport missing from it never
  // has an expanded board bought, whatever its config says. NFL was absent for
  // a day after its props shipped, so every scheduled run finished with an
  // empty `expanded` block and spent nothing. It now sorts second — behind
  // MLB, which is the expensive card, and ahead of soccer, whose single
  // expanded market can be dropped without leaving a fixture unbettable.
  assert.deepEqual(
    parseExpandedSportOrder(null, ["NFL", "WNBA", "MLB", "SOCCER"]),
    ["MLB", "NFL", "WNBA", "SOCCER"],
  );
  // NCAAF now has its two alternate game-line markets; a sport with no
  // expanded markets at all is still dropped.
  assert.deepEqual(parseExpandedSportOrder(null, ["NCAAF", "MMA"]), ["NCAAF"]);
  assert.deepEqual(parseExpandedSportOrder("WNBA,MLB", ["MLB", "WNBA"]), [
    "WNBA",
    "MLB",
  ]);
  assert.deepEqual(parseExpandedSportOrder("MLB", ["MLB", "WNBA"]), [
    "MLB",
    "WNBA",
  ]);
  assert.deepEqual(parseExpandedSportOrder(null, ["TENNIS"]), ["TENNIS"]);
  assert.deepEqual(parseExpandedSportOrder("TENNIS,MLB", ["MLB", "TENNIS"]), [
    "TENNIS",
    "MLB",
  ]);
});

test("a short key holds MLB credits so today's WNBA expanded board still fits", () => {
  const wnbaCost = expandedEventCreditCost("WNBA");
  const mlbCost = expandedEventCreditCost("MLB");
  assert.ok(mlbCost > 0);
  assert.ok(wnbaCost > 0);
  const later = laterExpandedCreditReserve([{ sport: "WNBA", events: 2 }]);
  assert.equal(later, wnbaCost * 2);
  assert.equal(shouldHoldCreditsForLater(100, mlbCost, later, 25), true);
  assert.equal(shouldHoldCreditsForLater(400, mlbCost, later, 25), false);
  assert.equal(shouldHoldCreditsForLater(null, mlbCost, later, 25), false);
  assert.equal(shouldHoldCreditsForLater(40, mlbCost, 0, 25), false);
});

test("event market catalog reads every key any covered book prices", () => {
  const payload = {
    bookmakers: [
      { key: "draftkings", markets: [{ key: "h2h" }, { key: "team_totals" }] },
      {
        key: "fanduel",
        markets: [{ key: "team_totals" }, { key: "batter_walks" }],
      },
      { key: "broken", markets: "not-an-array" },
    ],
  };
  assert.deepEqual(eventMarketCatalogKeys(payload).sort(), [
    "batter_walks",
    "h2h",
    "team_totals",
  ]);
  assert.deepEqual(eventMarketCatalogKeys(null), []);
  assert.deepEqual(eventMarketCatalogKeys({ bookmakers: [] }), []);
});

test("expanded markets drop keys no book is pricing, keeping request order", () => {
  const desired = ["alternate_spreads", "batter_walks", "pitcher_walks"];
  assert.deepEqual(
    intersectExpandedMarkets(desired, [
      "pitcher_walks",
      "h2h",
      "alternate_spreads",
    ]),
    ["alternate_spreads", "pitcher_walks"],
  );
  // A failed catalog lookup must not empty the board — it falls back to asking
  // for everything, which is exactly the old behaviour.
  assert.deepEqual(intersectExpandedMarkets(desired, []), desired);
});

test("the reserve prices an expanded event with its catalog call included", () => {
  // Estimating high is the safe direction: the catalog can only make the real
  // spend smaller, so a reserve built on it never starves the next sport.
  assert.equal(EVENT_MARKET_CATALOG_CREDIT_COST, 1);
  assert.equal(expandedEventCreditCost("MLB") > 40, true);
  // Football's expanded event is halves plus nine prop markets and their
  // alternate ladders. Well past CATALOG_WORTH_READING_MARKETS, so the catalog
  // is read first and only the keys a book actually prices are billed.
  const nflCost = expandedEventCreditCost("NFL");
  assert.ok(
    nflCost > CATALOG_WORTH_READING_MARKETS,
    `NFL asks for ${nflCost} keys, which should be worth a catalog read`,
  );
  // Still an order of magnitude under MLB's, which is the point of leaving the
  // football game ladder off.
  assert.ok(nflCost < expandedEventCreditCost("MLB"));
  assert.equal(expandedEventCreditCost("SOCCER"), 1);
});

test("the catalog is read for the sports whose request list can waste credits", () => {
  // MLB asks for 58 markets and WNBA 36: most of a prop card goes unpriced on
  // any given fixture, so one credit spent learning which keys are live saves
  // many. Tennis asks for four and soccer for one, where the catalog can cost
  // more than the markets it would skip.
  assert.ok(expandedBoardMarkets("MLB").length > CATALOG_WORTH_READING_MARKETS);
  assert.ok(
    expandedBoardMarkets("WNBA").length > CATALOG_WORTH_READING_MARKETS,
  );
  assert.ok(
    expandedBoardMarkets("TENNIS").length <= CATALOG_WORTH_READING_MARKETS,
  );
  assert.ok(
    expandedBoardMarkets("SOCCER").length <= CATALOG_WORTH_READING_MARKETS,
  );
});

test("a catalog outage keeps the full request list rather than emptying the board", () => {
  // [] means the lookup failed, not that the fixture prices nothing. Reading it
  // as "nothing is priced" would skip the odds call and blank a live board.
  const wanted = expandedBoardMarkets("MLB");
  assert.deepEqual(intersectExpandedMarkets(wanted, []), wanted);
});

test("a surface refresh that reached no provider is not a successful populate", () => {
  // The shape of the run that hid a spent key for a day: every sport served
  // last-good data, every board still held events, and the job went green.
  const allStale = {
    MLB: { source: "stale_provider_failure", stale: true },
    WNBA: { source: "stale_provider_failure", stale: true },
    TENNIS: { source: "stale_provider_failure", stale: true },
  };
  assert.equal(surfaceRefreshReachedProvider(true, allStale), false);

  // One live board is enough: the others may be out of season.
  assert.equal(
    surfaceRefreshReachedProvider(true, {
      ...allStale,
      MLB: { source: "provider", stale: false },
    }),
    true,
  );
});

test("a top-up that asked for no surface refresh is not judged on one", () => {
  // `surface=0` reads the cache by design, so `runtime_cache` everywhere is the
  // correct outcome, not a provider failure.
  assert.equal(
    surfaceRefreshReachedProvider(false, {
      MLB: { source: "runtime_cache", stale: false },
    }),
    true,
  );
});

test("stale sports are named so a frozen board says which one froze", () => {
  assert.deepEqual(
    staleSurfaceSports({
      WNBA: { source: "stale_cache_only", stale: true },
      MLB: { source: "provider", stale: false },
      TENNIS: { source: "stale_cache_only", stale: true },
    }),
    ["TENNIS", "WNBA"],
  );
});

test("a complete expanded board is refetched once its prices have aged", () => {
  const now = Date.parse("2026-08-26T13:22:00.000Z");
  const lastEvening = Date.parse("2026-08-25T18:20:00.000Z");
  // The shape of the 13:22 populate: covered, and serving prices from the
  // previous evening. Coverage alone said skip, which is how a board that was
  // filled once stopped moving for the rest of the day.
  assert.equal(canSkipExpandedEvent(true, lastEvening, 120, now), false);

  // Written by the run three hours earlier — also due.
  assert.equal(
    canSkipExpandedEvent(true, now - 3 * 60 * 60_000, 120, now),
    false,
  );

  // Written minutes ago: a manual run right after a scheduled one must not
  // re-bill the whole card.
  assert.equal(canSkipExpandedEvent(true, now - 5 * 60_000, 120, now), true);
});

test("an incomplete or uncached expanded board is never skipped", () => {
  const now = Date.now();
  assert.equal(canSkipExpandedEvent(false, now, 120, now), false);
  assert.equal(canSkipExpandedEvent(true, null, 120, now), false);
});

test("the expanded max age falls back rather than trusting a bad query value", () => {
  assert.equal(
    parseExpandedMaxAgeMinutes(null),
    DEFAULT_EXPANDED_MAX_AGE_MINUTES,
  );
  assert.equal(
    parseExpandedMaxAgeMinutes("nonsense"),
    DEFAULT_EXPANDED_MAX_AGE_MINUTES,
  );
  assert.equal(
    parseExpandedMaxAgeMinutes("-5"),
    DEFAULT_EXPANDED_MAX_AGE_MINUTES,
  );
  assert.equal(parseExpandedMaxAgeMinutes("45"), 45);
  // 0 forces every covered board to refetch — the escape hatch for a slate that
  // has to be rebuilt now.
  assert.equal(parseExpandedMaxAgeMinutes("0"), 0);
  assert.equal(parseExpandedMaxAgeMinutes("99999"), 24 * 60);
});

test("soccer expands every fixture on the board, not just today's slate", () => {
  // Double Chance is a single 1-credit market, and the soccer board carries
  // roughly six days of fixtures. Capping expansion to the ET slate day saved
  // almost nothing and cost the market entirely — 46 of 49 fixtures had no
  // Double Chance, so it appeared on a handful of games and vanished on the
  // rest.
  const now = new Date("2026-08-26T17:00:00Z");
  const events = [
    { id: "today", commenceTime: "2026-08-26T23:00:00Z" },
    { id: "tomorrow", commenceTime: "2026-08-27T23:00:00Z" },
    { id: "day-four", commenceTime: "2026-08-29T23:00:00Z" },
    { id: "started", commenceTime: "2026-08-26T12:00:00Z" },
  ] as unknown as OddsEvent[];

  const soccer = selectExpandedSlateEvents(events, ["today"], now, "SOCCER");
  assert.deepEqual(
    soccer.map((e) => e.id),
    ["today", "tomorrow", "day-four"],
  );
  // A fixture already under way is still excluded — full slate, not full history.
  assert.ok(!soccer.some((e) => e.id === "started"));

  // MLB keeps the slate-day budget control: its expanded board is ~20 credits a
  // game, so paying that for a fixture four days out is exactly what the filter
  // exists to prevent.
  assert.deepEqual(
    selectExpandedSlateEvents(events, ["today"], now, "MLB").map((e) => e.id),
    ["today"],
  );
  // Unchanged when no sport is supplied.
  assert.deepEqual(
    selectExpandedSlateEvents(events, ["today"], now).map((e) => e.id),
    ["today"],
  );
});

test("expandsFullSlate is keyed on cost shape and is case-insensitive", () => {
  assert.equal(expandsFullSlate("SOCCER"), true);
  assert.equal(expandsFullSlate("soccer"), true);
  assert.equal(expandsFullSlate(" Soccer "), true);
  assert.equal(expandsFullSlate("MLB"), false);
  assert.equal(expandsFullSlate("TENNIS"), false);
});

test("the deep board is only looked at once the book has plausibly opened it", () => {
  const now = Date.parse("2026-09-09T12:00:00Z");
  const inHours = (h: number) => new Date(now + h * 3_600_000).toISOString();

  // Football's slate is known days out and priced early.
  assert.equal(withinExpandedBuyWindow(inHours(30), "NFL", now), true);
  assert.equal(withinExpandedBuyWindow(inHours(40), "NFL", now), false);
  // Baseball opens later, so the same 30 hours is too early to pay attention.
  assert.equal(withinExpandedBuyWindow(inHours(30), "MLB", now), false);
  assert.equal(withinExpandedBuyWindow(inHours(6), "MLB", now), true);
  // A game already under way is never worth a buy.
  assert.equal(withinExpandedBuyWindow(inHours(-1), "NFL", now), false);
});

test("the one buy waits for the card to open, but never past last call", () => {
  const now = Date.parse("2026-09-09T12:00:00Z");
  const inHours = (h: number) => new Date(now + h * 3_600_000).toISOString();
  const featured = [
    "h2h_h1",
    "totals_h1",
    "player_pass_yds",
    "player_rush_yds",
    "player_receptions",
    "player_reception_yds",
  ];
  const ladders = featured.map((key) =>
    key.startsWith("h2h") || key.startsWith("totals")
      ? `alternate_${key}`
      : `${key}_alternate`,
  );
  const wanted = [...featured, ...ladders];

  // Two featured of six, eight hours out: hold. The catalog read cost a credit
  // and spent no allowance, so the next pass can still buy.
  assert.equal(
    shouldSpendExpandedBuy({
      priced: featured.slice(0, 2),
      wanted,
      commenceTime: inHours(8),
      now,
    }),
    false,
  );
  // The whole featured card open and NOT ONE alternate ladder posted. Judged
  // against everything requested this is half, and the buy would wait for last
  // call while every headline market sat there available — the board empty all
  // day for markets open by breakfast. Judged on the featured card it is full
  // coverage, and it buys.
  assert.equal(
    shouldSpendExpandedBuy({
      priced: featured,
      wanted,
      commenceTime: inHours(8),
      now,
    }),
    true,
  );
  // Two hours out, still thin: cappers need something to log more than they
  // need every alternate ladder.
  assert.equal(
    shouldSpendExpandedBuy({
      priced: featured.slice(0, 1),
      wanted,
      commenceTime: inHours(2),
      now,
    }),
    true,
  );
  // Nothing priced is never worth the odds call, at any hour.
  assert.equal(
    shouldSpendExpandedBuy({
      priced: [],
      wanted,
      commenceTime: inHours(1),
      now,
    }),
    false,
  );
});

test("every sport with an expanded card is in the pass that buys it", () => {
  // The invariant this whole file exists to protect. DEFAULT_EXPANDED_SPORT_ORDER
  // is the gate: a sport missing from it never has its expanded board bought,
  // however complete its markets and config are. NFL shipped props, was enabled,
  // had all 28 keys configured and a schedule that fired every six hours — and
  // bought nothing for a day, because it was absent from this one list and no
  // test compared the two.
  for (const sport of ODDS_CONTROL_SPORTS) {
    if (expandedBoardMarkets(sport).length === 0) continue;
    assert.ok(
      (DEFAULT_EXPANDED_SPORT_ORDER as readonly string[]).includes(sport),
      `${sport} has an expanded card but is missing from DEFAULT_EXPANDED_SPORT_ORDER, so nothing will ever buy it`,
    );
  }
});

test("an event is bought once a day by default", () => {
  // The owner decision: one deep board per event per buy day. It holds only
  // because a pass that finds nothing priced spends no allowance.
  assert.equal(DEFAULT_EVENT_BUYS_PER_DAY, 1);
  assert.ok(DEFAULT_EVENT_BUYS_PER_DAY <= HARD_MAX_EVENT_BUYS_PER_DAY);
});

// The 2026-09-11 MLB slate. The expanded pass at 06:45 UTC was handed the 12
// fixtures the 06:15 surface run had found and bought all 12 — a clean run by
// every number it reports. The 12:15 surface run found 15. Three games
// (Pirates at Cubs, Dodgers at Marlins, Rangers at Diamondbacks) had no
// alternates and no props all day, because the next expanded pass was not due
// until 18:45 and the Cubs first pitch was 18:21.
test("fixtures with no board at all bring the expanded pass forward", () => {
  const now = new Date("2026-09-11T12:15:00.000Z");
  const at = expandedCatchUpRunAt({
    uncovered: 3,
    scheduledAt: new Date("2026-09-11T18:45:00.000Z"),
    lastRunAt: new Date("2026-09-11T06:45:00.000Z"),
    now,
  });
  assert.ok(at, "three uncovered fixtures must not wait for the full cadence");
  assert.equal(at.getTime(), now.getTime() + EXPANDED_CATCHUP_MINUTES * 60_000);
  // Early enough that the 18:21 matinee is still bettable.
  assert.ok(at.getTime() < Date.parse("2026-09-11T18:21:00.000Z"));
});

test("a fully covered slate leaves the schedule alone", () => {
  assert.equal(
    expandedCatchUpRunAt({
      uncovered: 0,
      scheduledAt: new Date("2026-09-11T18:45:00.000Z"),
      lastRunAt: new Date("2026-09-11T06:45:00.000Z"),
      now: new Date("2026-09-11T12:15:00.000Z"),
    }),
    null,
  );
});

test("a pass that just ran does not immediately queue another", () => {
  const now = new Date("2026-09-11T12:15:00.000Z");
  // The run finished a minute ago and still left a fixture uncovered, because
  // no book has opened its deep card. Looking again costs a catalog credit, so
  // the retry is cheap — but it waits out the floor rather than spinning.
  const at = expandedCatchUpRunAt({
    uncovered: 1,
    scheduledAt: new Date("2026-09-12T00:15:00.000Z"),
    lastRunAt: new Date("2026-09-11T12:14:00.000Z"),
    now,
  });
  assert.ok(at);
  assert.equal(
    at.getTime(),
    Date.parse("2026-09-11T12:14:00.000Z") +
      EXPANDED_CATCHUP_MIN_GAP_MINUTES * 60_000,
  );
});

test("a catch-up never defers a run that is already due sooner", () => {
  const now = new Date("2026-09-11T12:15:00.000Z");
  // Due in five minutes. Rescheduling to now+15 would push the board further
  // away than leaving it alone, which is the one thing this must never do.
  assert.equal(
    expandedCatchUpRunAt({
      uncovered: 3,
      scheduledAt: new Date("2026-09-11T12:20:00.000Z"),
      lastRunAt: new Date("2026-09-11T06:45:00.000Z"),
      now,
    }),
    null,
  );
  // Overdue is likewise left alone.
  assert.equal(
    expandedCatchUpRunAt({
      uncovered: 3,
      scheduledAt: new Date("2026-09-11T11:00:00.000Z"),
      lastRunAt: new Date("2026-09-11T06:45:00.000Z"),
      now,
    }),
    null,
  );
});

test("a sport that has never run expanded still gets a catch-up", () => {
  const now = new Date("2026-09-11T12:15:00.000Z");
  const at = expandedCatchUpRunAt({
    uncovered: 2,
    scheduledAt: null,
    lastRunAt: null,
    now,
  });
  assert.ok(at);
  assert.equal(at.getTime(), now.getTime() + EXPANDED_CATCHUP_MINUTES * 60_000);
});
