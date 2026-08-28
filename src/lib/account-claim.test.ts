import assert from "node:assert/strict";
import test from "node:test";

import {
  ACCOUNT_RESTRICTED_MESSAGE,
  ACCOUNT_TAKEN_MESSAGE,
  HANDLE_TAKEN_MESSAGE,
  UNCLAIMED_HANDLE_MESSAGE,
  evaluateAccountClaim,
  handleTakenMessage,
  hasDeliverableEmail,
  isUnclaimedAccount,
} from "@/lib/account-claim";

const VERIFIED = new Date("2026-01-01T00:00:00.000Z");

test("an imported account with no password is unclaimed even when verified", () => {
  assert.equal(isUnclaimedAccount({ passwordHash: null }), true);
  assert.deepEqual(
    evaluateAccountClaim({
      passwordHash: null,
      emailVerified: VERIFIED,
      accountStatus: "ACTIVE",
    }),
    { claimable: true, reason: "UNCLAIMED" },
  );
});

// Regression: signup used to stamp `emailVerified` on every new row, which kept
// this branch near-unreachable. With the stamp gone, "unverified" describes every
// account that has not yet clicked its link — including established cappers — and
// letting the signup form claim those was an account takeover by handle.
test("an unverified account with a password is NOT claimable", () => {
  assert.deepEqual(
    evaluateAccountClaim({
      passwordHash: "hash",
      emailVerified: null,
      accountStatus: "PENDING",
    }),
    { claimable: false, error: ACCOUNT_TAKEN_MESSAGE },
  );
});

test("an unclaimed account is claimable whether or not it is verified", () => {
  for (const emailVerified of [null, VERIFIED]) {
    assert.deepEqual(
      evaluateAccountClaim({
        passwordHash: null,
        emailVerified,
        accountStatus: "ACTIVE",
      }),
      { claimable: true, reason: "UNCLAIMED" },
    );
  }
});

test("a real verified account is never claimable", () => {
  assert.deepEqual(
    evaluateAccountClaim({
      passwordHash: "hash",
      emailVerified: VERIFIED,
      accountStatus: "ACTIVE",
    }),
    { claimable: false, error: ACCOUNT_TAKEN_MESSAGE },
  );
});

test("restricted accounts cannot be claimed back through signup", () => {
  for (const accountStatus of ["SUSPENDED", "DISABLED"] as const) {
    assert.deepEqual(
      evaluateAccountClaim({
        passwordHash: null,
        emailVerified: null,
        accountStatus,
      }),
      { claimable: false, error: ACCOUNT_RESTRICTED_MESSAGE },
    );
  }
});

test("placeholder and reserved addresses are not deliverable", () => {
  assert.equal(hasDeliverableEmail("sharpshooter@legacy.scl"), false);
  assert.equal(hasDeliverableEmail("SharpShooter@Legacy.SCL "), false);
  assert.equal(hasDeliverableEmail("qa@example.com"), false);
  assert.equal(hasDeliverableEmail("qa@fixture.test"), false);
  assert.equal(hasDeliverableEmail("qa@service.local"), false);
  assert.equal(hasDeliverableEmail("missing-at-sign"), false);
  assert.equal(hasDeliverableEmail("capper@gmail.com"), true);
  // A real address that merely mentions the domain elsewhere still delivers.
  assert.equal(hasDeliverableEmail("legacy.scl@gmail.com"), true);
});

test("a taken handle explains itself when the profile is unclaimed", () => {
  assert.equal(
    handleTakenMessage({ passwordHash: null }),
    UNCLAIMED_HANDLE_MESSAGE,
  );
  assert.equal(
    handleTakenMessage({ passwordHash: "hash" }),
    HANDLE_TAKEN_MESSAGE,
  );
});
