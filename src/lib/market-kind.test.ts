import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
