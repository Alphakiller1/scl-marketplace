import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  adminNotificationRecipients,
  sendAffiliateSignupNotificationEmail,
} from "@/lib/email";
import { SCL_AFFILIATE_EMAIL } from "@/lib/store-connection";

const ORIGINAL = {
  adminTo: process.env.ADMIN_NOTIFICATION_EMAIL_TO,
  supportTo: process.env.SUPPORT_EMAIL_TO,
  resendKey: process.env.RESEND_API_KEY,
};

beforeEach(() => {
  delete process.env.ADMIN_NOTIFICATION_EMAIL_TO;
  delete process.env.SUPPORT_EMAIL_TO;
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  process.env.ADMIN_NOTIFICATION_EMAIL_TO = ORIGINAL.adminTo;
  process.env.SUPPORT_EMAIL_TO = ORIGINAL.supportTo;
  process.env.RESEND_API_KEY = ORIGINAL.resendKey;
});

describe("adminNotificationRecipients", () => {
  it("uses ADMIN_NOTIFICATION_EMAIL_TO when set", () => {
    process.env.ADMIN_NOTIFICATION_EMAIL_TO = "ops@scl.com, alerts@scl.com";
    assert.deepEqual(adminNotificationRecipients(), [
      "ops@scl.com",
      "alerts@scl.com",
    ]);
  });

  it("falls back to SUPPORT_EMAIL_TO then SCL affiliate ops email", () => {
    process.env.SUPPORT_EMAIL_TO = "support@scl.com";
    assert.deepEqual(adminNotificationRecipients(), ["support@scl.com"]);

    delete process.env.SUPPORT_EMAIL_TO;
    assert.deepEqual(adminNotificationRecipients(), [SCL_AFFILIATE_EMAIL]);
  });
});

describe("sendAffiliateSignupNotificationEmail", () => {
  it("logs in dev when Resend is not configured", async () => {
    const result = await sendAffiliateSignupNotificationEmail({
      capperUsername: "sharpcapper",
      capperEmail: "capper@example.com",
      provider: "WHOP",
      connectionId: "conn_123",
      submittedAt: new Date("2026-08-05T12:00:00.000Z"),
    });
    assert.equal(result.delivered, false);
  });
});
