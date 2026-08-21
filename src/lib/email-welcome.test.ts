import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  renderWelcomeEmail,
  sendWelcomeEmail,
  WELCOME_EMAIL_SUBJECT,
} from "@/lib/email";

const ORIGINAL = {
  authUrl: process.env.AUTH_URL,
  resendKey: process.env.RESEND_API_KEY,
};

beforeEach(() => {
  process.env.AUTH_URL = "https://sportscappersleaderboard.com";
  delete process.env.RESEND_API_KEY;
});

afterEach(() => {
  if (ORIGINAL.authUrl === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = ORIGINAL.authUrl;
  process.env.RESEND_API_KEY = ORIGINAL.resendKey;
});

describe("renderWelcomeEmail", () => {
  it("carries the three onboarding sections in both parts", () => {
    const { html, text } = renderWelcomeEmail({});

    for (const heading of [
      "📊 Build Your SCL Record",
      "🛒 Build Your SCL Store",
      "📣 We’re Driving Traffic to SCL",
    ]) {
      assert.ok(html.includes(heading), `html missing ${heading}`);
      assert.ok(text.includes(heading), `text missing ${heading}`);
    }

    for (const line of [
      "The new SCL platform is officially live",
      "verified 60-day, 90-day, and season-long performance history",
      "Winible or Whop packages through their SCL profile",
      "Track your plays → Build your record → Get discovered → Sell your packages.",
      "paid advertising and other promotional efforts",
      "Let’s see where you land on the leaderboard.",
      "— Sports Cappers Leaderboard",
    ]) {
      assert.ok(html.includes(line), `html missing: ${line}`);
      assert.ok(text.includes(line), `text missing: ${line}`);
    }
  });

  it("points the call to action at the configured host", () => {
    const { html, text } = renderWelcomeEmail({});
    assert.ok(
      html.includes('href="https://sportscappersleaderboard.com/login"'),
    );
    assert.ok(html.includes('href="https://sportscappersleaderboard.com"'));
    assert.ok(text.includes("https://sportscappersleaderboard.com/login"));
  });

  it("adds the announcement opt-out only when a link is supplied", () => {
    const without = renderWelcomeEmail({});
    assert.ok(!without.html.includes("Unsubscribe from announcements"));
    assert.ok(!without.text.includes("Unsubscribe from announcements"));

    const withLink = renderWelcomeEmail({
      unsubscribeUrl: "https://scl.test/unsubscribe?token=abc.def",
    });
    assert.ok(
      withLink.html.includes(
        '<a href="https://scl.test/unsubscribe?token=abc.def">Unsubscribe from announcements</a>',
      ),
    );
    assert.ok(
      withLink.text.includes(
        "Unsubscribe from announcements: https://scl.test/unsubscribe?token=abc.def",
      ),
    );
  });

  it("keeps the plain-text part free of markup and blank-line runs", () => {
    const { text } = renderWelcomeEmail({
      unsubscribeUrl: "https://scl.test/unsubscribe?token=abc.def",
    });
    assert.ok(!/<[a-z]/i.test(text), "text part contains HTML tags");
    assert.ok(!/\n{3,}/.test(text), "text part has a run of blank lines");
  });
});

describe("sendWelcomeEmail", () => {
  it("uses the owner-approved subject line", () => {
    assert.equal(
      WELCOME_EMAIL_SUBJECT,
      "Welcome to the new Sports Cappers Leaderboard!",
    );
  });

  it("reports undelivered instead of throwing when Resend is unconfigured", async () => {
    const result = await sendWelcomeEmail({ email: "capper@example.com" });
    assert.equal(result.delivered, false);
  });
});
