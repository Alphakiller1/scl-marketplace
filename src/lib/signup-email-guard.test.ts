import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ACCOUNT_RESTRICTED_MESSAGE } from "@/lib/account-claim";
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  EMAIL_AWAITING_VERIFICATION_MESSAGE,
  evaluateEmailAvailability,
  type ExistingEmailAccount,
} from "@/lib/signup-email-guard";

const verified: ExistingEmailAccount = {
  id: "verified-1",
  emailVerified: new Date("2026-08-01T00:00:00Z"),
  accountStatus: "ACTIVE",
};
const pending: ExistingEmailAccount = {
  id: "pending-1",
  emailVerified: null,
  accountStatus: "PENDING",
};
const suspended: ExistingEmailAccount = {
  id: "suspended-1",
  emailVerified: new Date("2026-08-01T00:00:00Z"),
  accountStatus: "SUSPENDED",
};

describe("evaluateEmailAvailability", () => {
  it("allows an address nobody holds", () => {
    assert.deepEqual(evaluateEmailAvailability([]), { available: true });
  });

  // The owner's case, and the live one: georgenewyork41@gmail.com held three
  // accounts, two of them verified.
  it("refuses a second account on a verified address", () => {
    const result = evaluateEmailAvailability([verified]);
    assert.equal(result.available, false);
    assert.equal(
      result.available === false && result.error,
      EMAIL_ALREADY_REGISTERED_MESSAGE,
    );
  });

  // Two of the four live duplicates are pairs where neither side verified. If
  // the rule only covered verified accounts it would miss half of them.
  it("refuses a second account on an unverified address, and says why", () => {
    const result = evaluateEmailAvailability([pending]);
    assert.equal(result.available, false);
    assert.equal(
      result.available === false && result.error,
      EMAIL_AWAITING_VERIFICATION_MESSAGE,
    );
  });

  // "Log in to your existing account" is wrong advice for a suspended one.
  it("sends a restricted account to support rather than to login", () => {
    const result = evaluateEmailAvailability([suspended]);
    assert.equal(
      result.available === false && result.error,
      ACCOUNT_RESTRICTED_MESSAGE,
    );
  });

  it("reports restriction ahead of the ordinary duplicate copy", () => {
    const result = evaluateEmailAvailability([pending, suspended, verified]);
    assert.equal(
      result.available === false && result.error,
      ACCOUNT_RESTRICTED_MESSAGE,
    );
  });

  it("prefers the verified copy when both kinds exist", () => {
    const result = evaluateEmailAvailability([pending, verified]);
    assert.equal(
      result.available === false && result.error,
      EMAIL_ALREADY_REGISTERED_MESSAGE,
    );
  });

  // A handle claim rewrites the email on the record it is taking over. Matching
  // that record against itself would refuse every legitimate claim.
  it("does not count the account a claim is taking over", () => {
    assert.deepEqual(evaluateEmailAvailability([verified], verified.id), {
      available: true,
    });
  });

  it("still refuses when a claim would collide with someone else", () => {
    const result = evaluateEmailAvailability([verified, pending], pending.id);
    assert.equal(
      result.available === false && result.error,
      EMAIL_ALREADY_REGISTERED_MESSAGE,
    );
  });
});

describe("EMAIL_ALREADY_REGISTERED_MESSAGE", () => {
  // The owner supplied this copy verbatim; it is the thing users read.
  it("says what the owner asked it to say", () => {
    assert.match(
      EMAIL_ALREADY_REGISTERED_MESSAGE,
      /already exists with this email address/,
    );
    assert.match(
      EMAIL_ALREADY_REGISTERED_MESSAGE,
      /log in to your existing account/,
    );
    assert.match(EMAIL_ALREADY_REGISTERED_MESSAGE, /Forgot Password/);
  });
});
