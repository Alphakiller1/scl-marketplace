import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  deriveProofReceiptState,
  formatClvPts,
  formatClosingLine,
  formatEvidenceId,
  proofStampLabel,
  proofStampTone,
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

  it("shortens evidence id", () => {
    assert.equal(formatEvidenceId(null), "—");
    assert.equal(formatEvidenceId("abcdefghijkl"), "ABCD…IJKL");
  });
});

describe("stamp vocabulary", () => {
  it("verified uses pink; win uses settlement tone", () => {
    assert.equal(proofStampLabel("captured"), "Verified");
    assert.equal(proofStampTone("captured"), "pink");
    assert.equal(proofStampTone("won"), "win");
    assert.equal(proofStampTone("loss"), "loss");
  });
});
