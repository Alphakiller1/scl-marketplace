import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BROADCAST_BATCH_SIZE,
  chunkRecipients,
  resolveBroadcastRecipients,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type BroadcastCandidate,
} from "@/lib/broadcast";
import { broadcastSchema } from "@/lib/schemas/broadcast.schema";

function candidate(over: Partial<BroadcastCandidate> = {}): BroadcastCandidate {
  return {
    id: "u1",
    email: "capper@example.com",
    username: "capper",
    emailVerified: new Date("2026-08-01"),
    accountStatus: "ACTIVE",
    isTest: false,
    marketingOptOut: false,
    ...over,
  };
}

describe("resolveBroadcastRecipients", () => {
  it("includes an ordinary active capper", () => {
    const out = resolveBroadcastRecipients("ALL_CAPPERS", [candidate()]);
    assert.equal(out.length, 1);
    assert.equal(out[0]!.email, "capper@example.com");
  });

  // The imported roster carries synthesized @legacy.scl addresses with no inbox.
  // Mailing them earns hard bounces, and a burned sender reputation takes
  // verification and password resets down with it.
  it("skips undeliverable legacy placeholder addresses", () => {
    const out = resolveBroadcastRecipients("ALL_CAPPERS", [
      candidate({ id: "u2", email: "oldtimer@legacy.scl" }),
    ]);
    assert.deepEqual(out, []);
  });

  it("never mails a suspended or disabled account", () => {
    for (const accountStatus of ["SUSPENDED", "DISABLED"]) {
      assert.deepEqual(
        resolveBroadcastRecipients("ALL_CAPPERS", [
          candidate({ accountStatus }),
        ]),
        [],
      );
      // Not even a direct, operational message.
      assert.deepEqual(
        resolveBroadcastRecipients("SINGLE_CAPPER", [
          candidate({ accountStatus }),
        ]),
        [],
      );
    }
  });

  it("honours the marketing opt-out on a mass send", () => {
    const opted = candidate({ marketingOptOut: true });
    assert.deepEqual(resolveBroadcastRecipients("ALL_CAPPERS", [opted]), []);
    assert.deepEqual(
      resolveBroadcastRecipients("VERIFIED_CAPPERS", [opted]),
      [],
    );
  });

  // A direct admin→capper message about their own account is operational, the
  // same category as a password reset, so the marketing opt-out does not apply.
  it("still delivers a direct message to someone who opted out of marketing", () => {
    const out = resolveBroadcastRecipients("SINGLE_CAPPER", [
      candidate({ marketingOptOut: true }),
    ]);
    assert.equal(out.length, 1);
  });

  it("excludes test accounts from mass sends but allows a direct one", () => {
    assert.deepEqual(
      resolveBroadcastRecipients("ALL_CAPPERS", [candidate({ isTest: true })]),
      [],
    );
    assert.equal(
      resolveBroadcastRecipients("SINGLE_CAPPER", [candidate({ isTest: true })])
        .length,
      1,
    );
  });

  it("VERIFIED_CAPPERS excludes accounts that never verified", () => {
    const unverified = candidate({ emailVerified: null });
    assert.deepEqual(
      resolveBroadcastRecipients("VERIFIED_CAPPERS", [unverified]),
      [],
    );
    assert.equal(
      resolveBroadcastRecipients("ALL_CAPPERS", [unverified]).length,
      1,
    );
  });

  // One inbox can carry several accounts here; a roster mail arriving three
  // times reads as a malfunction.
  it("sends one message per inbox, not per account", () => {
    const out = resolveBroadcastRecipients("ALL_CAPPERS", [
      candidate({ id: "a", email: "shared@brand.com", username: "one" }),
      candidate({ id: "b", email: "Shared@Brand.com", username: "two" }),
      candidate({ id: "c", email: "shared@brand.com", username: "three" }),
    ]);
    assert.equal(out.length, 1);
  });
});

describe("chunkRecipients", () => {
  it("splits into batches the provider will accept", () => {
    const many = Array.from({ length: 250 }, (_, i) => i);
    const chunks = chunkRecipients(many);
    assert.deepEqual(
      chunks.map((c) => c.length),
      [BROADCAST_BATCH_SIZE, BROADCAST_BATCH_SIZE, 50],
    );
  });

  it("returns nothing for an empty roster", () => {
    assert.deepEqual(chunkRecipients([]), []);
  });

  it("keeps a short list in one batch", () => {
    assert.equal(chunkRecipients([1, 2, 3]).length, 1);
  });
});

describe("broadcastSchema", () => {
  const message = {
    subject: "Roster update",
    body: "Here is this week's update for SCL cappers.",
  };

  it("requires a previewed recipient count for a mass email", () => {
    const result = broadcastSchema.safeParse({
      audience: "ALL_CAPPERS",
      ...message,
    });

    assert.equal(result.success, false);
    if (!result.success) {
      assert.match(result.error.issues[0]?.message ?? "", /recipient count/i);
    }
  });

  it("accepts a mass email after its recipient count is confirmed", () => {
    const result = broadcastSchema.safeParse({
      audience: "ALL_CAPPERS",
      confirmRecipientCount: 100,
      ...message,
    });

    assert.equal(result.success, true);
  });

  it("does not require a recipient count for one capper", () => {
    const result = broadcastSchema.safeParse({
      audience: "SINGLE_CAPPER",
      userId: "capper-1",
      ...message,
    });

    assert.equal(result.success, true);
  });
});

describe("unsubscribe tokens", () => {
  const SECRET = "test-secret";

  it("round-trips a signed token", () => {
    const token = signUnsubscribeToken("user-123", SECRET);
    assert.equal(verifyUnsubscribeToken(token, SECRET), "user-123");
  });

  // The point of signing: a link for one account cannot be edited into a link
  // that opts somebody else out.
  it("rejects a token whose user id was swapped", () => {
    const token = signUnsubscribeToken("user-123", SECRET);
    const forged = token.replace("user-123", "user-456");
    assert.equal(verifyUnsubscribeToken(forged, SECRET), null);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signUnsubscribeToken("user-123", "other-secret");
    assert.equal(verifyUnsubscribeToken(token, SECRET), null);
  });

  it("rejects malformed tokens without throwing", () => {
    for (const bad of ["", "nodot", ".", "user-123.", "user-123.short"]) {
      assert.equal(verifyUnsubscribeToken(bad, SECRET), null);
    }
  });

  it("handles an id containing dots", () => {
    const token = signUnsubscribeToken("a.b.c", SECRET);
    assert.equal(verifyUnsubscribeToken(token, SECRET), "a.b.c");
  });
});
