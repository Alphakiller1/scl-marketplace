import assert from "node:assert/strict";
import { test } from "node:test";

import {
  computeVerifiedShare,
  isVerifiedTier,
  verificationTierMeta,
} from "@/lib/verification";

test("isVerifiedTier: only VERIFIED and AUTO_VERIFIED clear the bar", () => {
  assert.equal(isVerifiedTier("VERIFIED"), true);
  assert.equal(isVerifiedTier("AUTO_VERIFIED"), true);
  assert.equal(isVerifiedTier("SELF_REPORTED"), false);
});

test("verificationTierMeta: verified tones vs muted", () => {
  assert.equal(verificationTierMeta("VERIFIED").tone, "verified");
  assert.equal(verificationTierMeta("AUTO_VERIFIED").tone, "verified");
  assert.equal(verificationTierMeta("SELF_REPORTED").tone, "muted");
  assert.equal(verificationTierMeta("VERIFIED").short, "Verified");
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
