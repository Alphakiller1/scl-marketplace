import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allGameLineLabels, isGameLineMarket } from "@/lib/market-kind";
import { normalizeEventBoard } from "@/lib/odds-board";
import { isPeriodMarket } from "@/lib/period-markets";
import type { RawEventOdds } from "@/lib/odds-verify";

/**
 * End-to-end proof that a first-innings line reaches the screen.
 *
 * F3/F5/F7 were reported missing repeatedly, and each time the fetch was fine —
 * the markets were requested, returned and billed. They died on the way to the
 * UI, at two separate gates, and fixing one only moved the failure to the
 * other. So this test does not check a gate; it walks the whole path a real
 * payload takes: Odds API JSON -> normalizeEventBoard -> the classifier that
 * splits game lines from player props -> the tab strip that decides what is
 * rendered. If any link drops period markets again, this fails.
 *
 * The payload mirrors a real per-event response: the same market keys The Odds
 * API returns for MLB (`totals_1st_5_innings`, `h2h_1st_5_innings`,
 * `spreads_1st_3_innings`), alongside the full-game markets and one player prop
 * so the buckets are genuinely competing.
 */

const MLB_EVENT: RawEventOdds = {
  id: "evt_mlb_1",
  sport_key: "baseball_mlb",
  commence_time: "2026-08-08T23:05:00Z",
  home_team: "New York Yankees",
  away_team: "Boston Red Sox",
  bookmakers: [
    {
      key: "draftkings",
      title: "DraftKings",
      last_update: "2026-08-08T21:00:00Z",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "New York Yankees", price: -140 },
            { name: "Boston Red Sox", price: 120 },
          ],
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", price: -110, point: 8.5 },
            { name: "Under", price: -110, point: 8.5 },
          ],
        },
        {
          key: "h2h_1st_5_innings",
          outcomes: [
            { name: "New York Yankees", price: -125 },
            { name: "Boston Red Sox", price: 105 },
          ],
        },
        {
          key: "totals_1st_5_innings",
          outcomes: [
            { name: "Over", price: -115, point: 4.5 },
            { name: "Under", price: -105, point: 4.5 },
          ],
        },
        {
          key: "spreads_1st_3_innings",
          outcomes: [
            { name: "New York Yankees", price: -120, point: -0.5 },
            { name: "Boston Red Sox", price: 100, point: 0.5 },
          ],
        },
        {
          key: "pitcher_strikeouts",
          outcomes: [
            {
              name: "Over",
              description: "Gerrit Cole",
              price: -115,
              point: 6.5,
            },
            {
              name: "Under",
              description: "Gerrit Cole",
              price: -105,
              point: 6.5,
            },
          ],
        },
      ],
    },
  ],
} as unknown as RawEventOdds;

/** Exactly what odds-assist does to decide which tabs exist. */
function tabsFor(selections: { market: string }[]): string[] {
  return allGameLineLabels().filter((market) =>
    selections.some((s) => s.market === market),
  );
}

describe("period lines reach the board", () => {
  const selections = normalizeEventBoard(MLB_EVENT);

  it("normalizes first-innings markets into selections", () => {
    const periodMarkets = [
      ...new Set(
        selections.filter((s) => isPeriodMarket(s.market)).map((s) => s.market),
      ),
    ].sort();

    assert.deepEqual(periodMarkets, [
      "1st 3 Innings Spread",
      "1st 5 Innings Moneyline",
      "1st 5 Innings Total",
    ]);
  });

  it("classifies them as game lines, not player props", () => {
    // The player-prop bucket drops anything without a player, so a
    // misclassified period line is discarded outright.
    for (const s of selections.filter((x) => isPeriodMarket(x.market))) {
      assert.equal(
        isGameLineMarket(s.market),
        true,
        `${s.market} would be routed to the player-prop bucket and dropped`,
      );
      assert.equal(s.player, undefined, `${s.market} must carry no player`);
    }
  });

  it("gives each period market its own tab", () => {
    const tabs = tabsFor(selections);
    for (const market of [
      "1st 5 Innings Moneyline",
      "1st 5 Innings Total",
      "1st 3 Innings Spread",
    ]) {
      assert.ok(
        tabs.includes(market),
        `no tab for ${market} — it would render nowhere. Tabs: ${tabs.join(", ")}`,
      );
    }
    // Full-game markets still lead.
    assert.equal(tabs[0], "Moneyline");
  });

  it("keeps the player prop in the prop bucket", () => {
    const props = selections.filter((s) => !isGameLineMarket(s.market));
    assert.ok(props.length > 0, "the player prop vanished");
    for (const p of props) {
      assert.ok(
        p.player,
        `${p.market} has no player but is bucketed as a prop`,
      );
    }
  });

  it("prices a first-five selection a capper can actually click", () => {
    const f5Total = selections.filter(
      (s) => s.market === "1st 5 Innings Total",
    );
    assert.equal(f5Total.length, 2, "expected an Over and an Under");
    const over = f5Total.find((s) => /over/i.test(s.side));
    assert.ok(over, "no Over side");
    assert.equal(over.line, 4.5);
    assert.equal(over.oddsAmerican, -115);
    // Selection text must name the segment, so the logged play still reads as
    // a period pick anywhere only the selection is shown.
    assert.match(over.selection, /F5|1st 5/i);
  });
});
