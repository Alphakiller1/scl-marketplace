import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  allGameLineLabels,
  CORE_GAME_MARKETS,
  isGameLineMarket,
} from "@/lib/market-kind";
import { PROP_MARKET_LABEL } from "@/lib/odds-verify";
import { PERIOD_MARKET_LABEL } from "@/lib/period-markets";
import { TEAM_TOTAL_LABEL } from "@/lib/team-total-markets";

describe("isGameLineMarket", () => {
  /**
   * The closure guard. Two markets have already shipped invisible because the
   * classifier did not know them — a game line it fails to recognise is routed
   * to the player-prop bucket, grouped by a player it does not have, and
   * dropped. Walking the registries means registering a market without teaching
   * the classifier fails here instead of rendering an empty section in
   * production.
   */
  it("recognises every registered game-line label", () => {
    const labels = allGameLineLabels();
    assert.ok(labels.length >= 3 + 9 + 1, "registry looks unexpectedly small");
    for (const label of labels) {
      assert.equal(
        isGameLineMarket(label),
        true,
        `${label} is registered as a game line but classifies as a player prop — it will render nothing`,
      );
    }
  });

  it("covers every period segment the board can price", () => {
    for (const label of Object.values(PERIOD_MARKET_LABEL)) {
      assert.equal(isGameLineMarket(label), true, label);
    }
  });

  it("covers team totals", () => {
    assert.equal(isGameLineMarket(TEAM_TOTAL_LABEL), true);
  });

  it("covers the full-game markets", () => {
    for (const label of CORE_GAME_MARKETS) {
      assert.equal(isGameLineMarket(label), true);
    }
  });

  // The other direction matters too: a player prop misclassified as a game line
  // loses its player grouping and its headshot, and lands in the wrong section.
  it("classifies every curated player prop as NOT a game line", () => {
    for (const label of Object.values(PROP_MARKET_LABEL)) {
      assert.equal(
        isGameLineMarket(label),
        false,
        `${label} is a player prop but classifies as a game line`,
      );
    }
  });

  it("tolerates surrounding whitespace", () => {
    assert.equal(isGameLineMarket("  Moneyline "), true);
    assert.equal(isGameLineMarket(" Team Total "), true);
  });

  it("does not match an unknown market", () => {
    assert.equal(isGameLineMarket("Winning Margin"), false);
    assert.equal(isGameLineMarket(""), false);
  });
});

describe("odds-assist tab strip", () => {
  /**
   * Classifying a market correctly is only half the journey to the screen.
   * The tab strip was built from `CORE_GAME_MARKETS` alone, so F5/F3/F7 passed
   * `isGameLineMarket` — which kept them out of the player-prop bucket — and
   * then matched no tab, and rendered nowhere. Fetched, billed, invisible.
   *
   * Reading the source keeps the two in step: the tabs must be derived from the
   * registry, never from the three core labels.
   */
  it("derives its market order from the registry, not the core three", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/scl/odds-assist.tsx"),
      "utf8",
    );
    assert.match(
      source,
      /const MARKET_ORDER = allGameLineLabels\(\)/,
      "MARKET_ORDER must come from allGameLineLabels() so every registered period segment gets a tab",
    );
    assert.doesNotMatch(
      source,
      /const MARKET_ORDER = CORE_GAME_MARKETS/,
      "MARKET_ORDER = CORE_GAME_MARKETS leaves period markets with no tab to render in",
    );
  });

  it("orders full-game markets ahead of period segments", () => {
    const labels = allGameLineLabels();
    for (const core of CORE_GAME_MARKETS) {
      for (const period of Object.values(PERIOD_MARKET_LABEL)) {
        assert.ok(
          labels.indexOf(core) < labels.indexOf(period),
          `${core} must sort before ${period}`,
        );
      }
    }
  });
});
