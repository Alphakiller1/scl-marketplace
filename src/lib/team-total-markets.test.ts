import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isTeamTotalMarket,
  outcomeDescriptionFor,
  parseTeamTotalSelection,
  TEAM_TOTAL_LABEL,
  TEAM_TOTAL_MARKET_KEYS,
  teamTotalSelectionText,
} from "@/lib/team-total-markets";

describe("isTeamTotalMarket", () => {
  it("matches the stored label, case-insensitively", () => {
    assert.equal(isTeamTotalMarket(TEAM_TOTAL_LABEL), true);
    assert.equal(isTeamTotalMarket("team total"), true);
    assert.equal(isTeamTotalMarket("  Team Total  "), true);
  });

  // The whole hazard: "Total" and "1st 5 Innings Total" both contain "total",
  // and settling either as a team total (or vice versa) grades the wrong number.
  it("does not match the game total or a period total", () => {
    assert.equal(isTeamTotalMarket("Total"), false);
    assert.equal(isTeamTotalMarket("1st 5 Innings Total"), false);
    assert.equal(isTeamTotalMarket("Moneyline"), false);
  });
});

describe("teamTotalSelectionText", () => {
  it("writes the canonical form", () => {
    assert.equal(
      teamTotalSelectionText("New York Yankees", "Over", 4.5),
      "New York Yankees Over 4.5",
    );
  });

  it("normalizes the side the feed reports", () => {
    assert.equal(
      teamTotalSelectionText("Reds", "under", 3.5),
      "Reds Under 3.5",
    );
    assert.equal(teamTotalSelectionText("Reds", "U", 3.5), "Reds Under 3.5");
  });

  it("round-trips through the parser", () => {
    const text = teamTotalSelectionText("Tampa Bay Rays", "Over", 4);
    assert.deepEqual(parseTeamTotalSelection(text), {
      team: "Tampa Bay Rays",
      side: "Over",
      line: 4,
    });
  });
});

describe("parseTeamTotalSelection", () => {
  it("reads a multi-word club", () => {
    assert.deepEqual(parseTeamTotalSelection("Chicago White Sox Under 3.5"), {
      team: "Chicago White Sox",
      side: "Under",
      line: 3.5,
    });
  });

  // Strictness is the safety property: anything it cannot read stays PENDING
  // instead of being graded on a guess about which club it names.
  it("refuses free-text shorthand", () => {
    assert.equal(parseTeamTotalSelection("Nats TT O4.5"), null);
    assert.equal(parseTeamTotalSelection("Over 4.5"), null);
    assert.equal(parseTeamTotalSelection("Yankees Over"), null);
    assert.equal(parseTeamTotalSelection(""), null);
  });
});

describe("TEAM_TOTAL_MARKET_KEYS", () => {
  // The featured key carries one line per club; the ladder lives in the
  // alternate key. Requesting only the first is why an alternate ladder visible
  // at the book shows a single line on the board.
  it("requests the featured and alternate keys", () => {
    assert.deepEqual(
      [...TEAM_TOTAL_MARKET_KEYS],
      ["team_totals", "alternate_team_totals"],
    );
  });
});

describe("outcomeDescriptionFor", () => {
  // The live-price lookup filters on the provider's `description` only when a
  // value is supplied. A team total that supplies none matches whichever side's
  // Over/Under of the same number comes first — and both clubs have one — so the
  // pick is re-priced against the opponent. That is how a Red Sox line tapped at
  // -650 was written as -154.
  it("names the club for a team total", () => {
    assert.equal(
      outcomeDescriptionFor({
        market: "Team Total",
        selection: "Boston Red Sox Over 2.5",
      }),
      "Boston Red Sox",
    );
  });

  it("keeps the player for a prop", () => {
    assert.equal(
      outcomeDescriptionFor({
        market: "Strikeouts",
        selection: "Zack Wheeler Over 4.5",
        player: "Zack Wheeler",
      }),
      "Zack Wheeler",
    );
  });

  it("supplies nothing for a plain game line, so it is not over-filtered", () => {
    assert.equal(
      outcomeDescriptionFor({ market: "Total", selection: "Over 8.5" }),
      undefined,
    );
    assert.equal(
      outcomeDescriptionFor({
        market: "Moneyline",
        selection: "Boston Red Sox",
      }),
      undefined,
    );
  });

  // Free text cannot be resolved to a club, so it supplies nothing rather than
  // guessing — the lookup then fails to price it, which is the safe outcome.
  it("supplies nothing for an unparseable team total", () => {
    assert.equal(
      outcomeDescriptionFor({
        market: "Team Total",
        selection: "Nats TT O4.5",
      }),
      undefined,
    );
  });
});
