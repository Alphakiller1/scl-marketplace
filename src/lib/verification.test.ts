import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeVerifiedShare,
  isVerifiedTier,
  submissionReceiptCopy,
  verificationTierMeta,
} from "@/lib/verification";

const CAPTURED_AT = "2026-07-13T23:20:00.000Z";

test("isVerifiedTier: only VERIFIED and AUTO_VERIFIED clear the bar", () => {
  assert.equal(isVerifiedTier("VERIFIED"), true);
  assert.equal(isVerifiedTier("AUTO_VERIFIED"), true);
  assert.equal(isVerifiedTier("SELF_REPORTED"), false);
});

test("verificationTierMeta: verified tones vs muted; legacy tier is Logged", () => {
  assert.equal(verificationTierMeta("VERIFIED").tone, "verified");
  assert.equal(verificationTierMeta("AUTO_VERIFIED").tone, "verified");
  assert.equal(verificationTierMeta("SELF_REPORTED").tone, "muted");
  assert.equal(verificationTierMeta("VERIFIED").short, "Verified");
  assert.equal(verificationTierMeta("SELF_REPORTED").short, "Logged");
  assert.equal(verificationTierMeta("SELF_REPORTED").label, "Logged");
  assert.match(
    verificationTierMeta("SELF_REPORTED").description,
    /not board-checked/i,
  );
});

test("computeVerifiedShare: fraction of verified picks, as 0–100", () => {
  assert.equal(computeVerifiedShare([]), 0);
  assert.equal(computeVerifiedShare(["SELF_REPORTED", "SELF_REPORTED"]), 0);
  assert.equal(computeVerifiedShare(["VERIFIED", "AUTO_VERIFIED"]), 100);
  assert.equal(
    computeVerifiedShare(["VERIFIED", "SELF_REPORTED", "SELF_REPORTED"]),
    (1 / 3) * 100,
  );
});

test("submissionReceiptCopy: verified straight pick", () => {
  const copy = submissionReceiptCopy({
    kind: "straight",
    selection: "Dream ML",
    market: "Moneyline",
    oddsAmerican: -315,
    capturedAt: CAPTURED_AT,
    loggedPreGame: true,
    oddsVerified: true,
    tier: "VERIFIED",
  });
  assert.equal(copy.headline, "Pick Verified");
  assert.equal(copy.summary, "Dream ML -315");
  assert.equal(copy.context, "Moneyline");
  assert.equal(copy.statusLine, "Odds captured pre-game");
  assert.equal(copy.gradingLine, "Graded automatically after final");
  assert.equal(copy.tone, "verified");
});

test("submissionReceiptCopy: self-reported straight does not claim verified", () => {
  const copy = submissionReceiptCopy({
    kind: "straight",
    selection: "Lakers -4.5",
    market: "Spread",
    oddsAmerican: -110,
    capturedAt: CAPTURED_AT,
    loggedPreGame: true,
    oddsVerified: false,
    tier: "SELF_REPORTED",
  });
  assert.equal(copy.headline, "Logged");
  assert.match(copy.statusLine, /not board-verified/i);
  assert.equal(copy.tone, "muted");
  assert.doesNotMatch(copy.headline, /verified/i);
});

test("submissionReceiptCopy: verified parlay", () => {
  const copy = submissionReceiptCopy({
    kind: "parlay",
    legCount: 3,
    combinedOddsAmerican: 625,
    capturedAt: CAPTURED_AT,
    allLoggedPreGame: true,
    verifiedLegCount: 3,
    tiers: ["VERIFIED", "VERIFIED", "VERIFIED"],
  });
  assert.equal(copy.headline, "Parlay Submitted");
  assert.equal(copy.summary, "3 legs · +625");
  assert.equal(copy.statusLine, "All legs locked from the board");
  assert.equal(copy.gradingLine, "Graded automatically after results settle");
  assert.equal(copy.tone, "verified");
});

test("submissionReceiptCopy: mixed-tier parlay stays honest", () => {
  const copy = submissionReceiptCopy({
    kind: "parlay",
    legCount: 3,
    combinedOddsAmerican: 400,
    capturedAt: CAPTURED_AT,
    allLoggedPreGame: true,
    verifiedLegCount: 2,
    tiers: ["VERIFIED", "VERIFIED", "SELF_REPORTED"],
  });
  assert.equal(copy.headline, "Parlay Submitted");
  assert.match(copy.statusLine, /self-reported/i);
  assert.equal(copy.tone, "muted");
});
