import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  brevoEventTime,
  classifyBrevoFailure,
  normalizeBrevoEvent,
} from "@/lib/brevo-send";
import { queuedRecipientBlock, type BroadcastCandidate } from "@/lib/broadcast";

describe("Brevo failure handling", () => {
  it("stops the run on account-level refusals", () => {
    for (const status of [401, 402, 403, 429]) {
      assert.equal(classifyBrevoFailure(status), "fatal");
    }
  });

  it("retries server errors and fails bad requests outright", () => {
    assert.equal(classifyBrevoFailure(500), "retryable");
    assert.equal(classifyBrevoFailure(503), "retryable");
    assert.equal(classifyBrevoFailure(400), "permanent");
  });
});

describe("Brevo webhook events", () => {
  it("maps Brevo's event names, including invalid_email", () => {
    assert.equal(normalizeBrevoEvent("invalid_email"), "invalid");
    assert.equal(normalizeBrevoEvent("hard_bounce"), "hard_bounce");
    assert.equal(normalizeBrevoEvent("unique_opened"), "opened");
    assert.equal(normalizeBrevoEvent("unique_proxy_open"), "proxy_open");
    assert.equal(normalizeBrevoEvent("click"), null);
  });

  it("uses the provider's event time when it is plausible", () => {
    const now = new Date("2026-10-01T12:00:00.000Z");
    const at = brevoEventTime(
      { ts_event: Date.parse("2026-10-01T11:00:00.000Z") / 1000 },
      now,
    );
    assert.equal(at.toISOString(), "2026-10-01T11:00:00.000Z");
    // A future timestamp is not trusted.
    assert.equal(
      brevoEventTime({ ts_event: now.getTime() / 1000 + 3600 }, now),
      now,
    );
    assert.equal(brevoEventTime({}, now), now);
  });
});

describe("send-time recipient re-check", () => {
  const candidate: BroadcastCandidate = {
    id: "u1",
    email: "Capper@scl.com",
    username: "capper",
    emailVerified: new Date(),
    accountStatus: "ACTIVE",
    isTest: false,
    marketingOptOut: false,
  };
  const none = new Set<string>();

  it("lets an unchanged eligible recipient through", () => {
    assert.equal(
      queuedRecipientBlock("ALL_CAPPERS", "capper@scl.com", candidate, none),
      null,
    );
  });

  it("blocks someone who opted out after the campaign was queued", () => {
    assert.equal(
      queuedRecipientBlock(
        "FILTERED_CAPPERS",
        "capper@scl.com",
        { ...candidate, marketingOptOut: true },
        none,
      ),
      "unsubscribed",
    );
  });

  it("still delivers a direct message to an opted-out capper", () => {
    assert.equal(
      queuedRecipientBlock(
        "SINGLE_CAPPER",
        "capper@scl.com",
        { ...candidate, marketingOptOut: true },
        none,
      ),
      null,
    );
  });

  it("blocks suspended accounts, changed addresses, and bounced inboxes", () => {
    assert.equal(
      queuedRecipientBlock(
        "ALL_CAPPERS",
        "capper@scl.com",
        { ...candidate, accountStatus: "SUSPENDED" },
        none,
      ),
      "ineligible",
    );
    assert.equal(
      queuedRecipientBlock("ALL_CAPPERS", "old@scl.com", candidate, none),
      "address_changed",
    );
    assert.equal(
      queuedRecipientBlock(
        "ALL_CAPPERS",
        "capper@scl.com",
        candidate,
        new Set(["capper@scl.com"]),
      ),
      "suppressed",
    );
    assert.equal(
      queuedRecipientBlock("ALL_CAPPERS", "capper@scl.com", null, none),
      "ineligible",
    );
  });
});
