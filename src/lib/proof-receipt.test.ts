import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveProofReceiptState,
  formatClvPts,
  formatClosingLine,
  formatEvidenceId,
  missingCloseOrClvTooltip,
  proofStampLabel,
  proofStampTone,
  proofUnitsLabel,
} from "@/lib/proof-receipt";

describe("deriveProofReceiptState", () => {
  it("prefers capturing over other flags", () => {
    assert.equal(
      deriveProofReceiptState({
        capturing: true,
        outcome: "WIN",
        verified: true,
      }),
      "capturing",
    );
  });

  it("returns line-moved when flagged", () => {
    assert.equal(
      deriveProofReceiptState({ lineMoved: true, verified: true }),
      "line-moved",
    );
  });

  it("returns source-unavailable when flagged", () => {
    assert.equal(
      deriveProofReceiptState({ sourceUnavailable: true }),
      "source-unavailable",
    );
  });

  it("maps outcomes to settlement states", () => {
    assert.equal(deriveProofReceiptState({ outcome: "WIN" }), "won");
    assert.equal(deriveProofReceiptState({ outcome: "LOSS" }), "loss");
    assert.equal(deriveProofReceiptState({ outcome: "PUSH" }), "push");
    assert.equal(deriveProofReceiptState({ outcome: "VOID" }), "void");
  });

  it("uses captured for verified pre-game pending", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    assert.equal(
      deriveProofReceiptState({
        outcome: "PENDING",
        eventStartsAt: future,
        verified: true,
      }),
      "captured",
    );
  });

  it("uses pending for self-reported pre-game", () => {
    const future = new Date(Date.now() + 60 * 60 * 1000);
    assert.equal(
      deriveProofReceiptState({
        outcome: "PENDING",
        eventStartsAt: future,
        verified: false,
      }),
      "pending",
    );
  });

  it("derives live and awaiting-grade from schedule", () => {
    const started = new Date(Date.now() - 30 * 60 * 1000);
    assert.equal(
      deriveProofReceiptState({
        outcome: "PENDING",
        eventStartsAt: started,
        verified: true,
      }),
      "live",
    );
    const old = new Date(Date.now() - 6 * 60 * 60 * 1000);
    assert.equal(
      deriveProofReceiptState({
        outcome: "PENDING",
        eventStartsAt: old,
        verified: true,
      }),
      "awaiting-grade",
    );
  });
});

describe("honest closing / CLV / evidence", () => {
  it("em-dash when closing or CLV missing", () => {
    assert.equal(formatClosingLine(null), "—");
    assert.equal(formatClosingLine(undefined), "—");
    assert.equal(formatClvPts(null), "—");
    assert.equal(formatClvPts(undefined), "—");
  });

  it("formats closing and CLV when present", () => {
    assert.equal(formatClosingLine(-110), "-110");
    assert.equal(formatClosingLine(150), "+150");
    assert.equal(formatClvPts(0.0123), "+0.01 pts");
    assert.equal(formatClvPts(-0.02), "-0.02 pts");
  });

  it("never renders a CLV that rounds to zero", () => {
    // The live board showed "BEAT CLOSE · +0.00 pts" and the Evidence Brief
    // showed "-0.00 pts". Both were real measurements too small to survive two
    // decimals — a signed zero asserts a beat, or a loss, that is not there.
    assert.equal(formatClvPts(0), "—");
    assert.equal(formatClvPts(-0), "—");
    assert.equal(formatClvPts(0.0001), "—");
    assert.equal(formatClvPts(-0.0001), "—");
    assert.equal(formatClvPts(0.004), "—");
    // The first value that genuinely rounds to a hundredth still renders.
    assert.equal(formatClvPts(0.005), "+0.01 pts");
    assert.equal(formatClvPts(-0.005), "-0.01 pts");
  });

  it("shortens evidence id", () => {
    assert.equal(formatEvidenceId(null), "—");
    assert.equal(formatEvidenceId("abcdefghijkl"), "ABCD…IJKL");
  });

  it("empty Close/CLV tooltips stay honest", () => {
    assert.equal(missingCloseOrClvTooltip(null), "Not Available");
    assert.equal(missingCloseOrClvTooltip(undefined), "Not Available");
    const past = new Date(Date.now() - 60_000).toISOString();
    assert.equal(missingCloseOrClvTooltip(past), "Not Available");
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    assert.equal(missingCloseOrClvTooltip(future), "Not Captured Yet");
    assert.doesNotMatch(
      missingCloseOrClvTooltip(past),
      /event window|still open/i,
    );
  });
});

describe("stamp vocabulary", () => {
  it("verified uses pink; win uses settlement tone", () => {
    assert.equal(proofStampLabel("captured"), "Odds Verified");
    assert.equal(proofStampLabel("live"), "Pending");
    assert.equal(proofStampTone("captured"), "pink");
    assert.equal(proofStampTone("won"), "win");
    assert.equal(proofStampTone("loss"), "loss");
  });
});

describe("receipt unit label", () => {
  it("labels graded units as a result and open units as projected", () => {
    assert.equal(proofUnitsLabel("won"), "Result");
    assert.equal(proofUnitsLabel("loss"), "Result");
    assert.equal(proofUnitsLabel("push"), "Result");
    assert.equal(proofUnitsLabel("captured"), "To win");
    assert.equal(proofUnitsLabel("live"), "To win");
  });
});
