import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, beforeEach, afterEach } from "node:test";

import { renderEmailTemplate } from "@/lib/email-template-render";
import {
  EMAIL_TEMPLATES,
  bodyPlacesButton,
  defaultEmailTemplate,
  unknownVariables,
} from "@/lib/email-templates";

const ORIGINAL_AUTH_URL = process.env.AUTH_URL;

beforeEach(() => {
  process.env.AUTH_URL = "https://sportscappersleaderboard.com";
});

afterEach(() => {
  if (ORIGINAL_AUTH_URL === undefined) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = ORIGINAL_AUTH_URL;
});

function renderWelcome(unsubscribeUrl?: string) {
  const template = defaultEmailTemplate("WELCOME");
  return renderEmailTemplate({
    body: template.body,
    actionLabel: template.actionLabel,
    actionUrl: "https://sportscappersleaderboard.com/login",
    footnote: template.footnote,
    footerHtml: unsubscribeUrl
      ? `<p><a href="${unsubscribeUrl}">Unsubscribe from announcements</a></p>`
      : undefined,
    footerText: unsubscribeUrl
      ? `Unsubscribe from announcements: ${unsubscribeUrl}`
      : undefined,
  });
}

describe("the welcome copy that ships in the build", () => {
  it("still carries the three onboarding sections in both parts", () => {
    const { html, text } = renderWelcome();

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

  it("points the call to action at the login page", () => {
    const { html, text } = renderWelcome();
    assert.ok(
      html.includes('href="https://sportscappersleaderboard.com/login"'),
    );
    assert.ok(text.includes("https://sportscappersleaderboard.com/login"));
  });

  it("adds the announcement opt-out only when a link is supplied", () => {
    const without = renderWelcome();
    assert.ok(!without.html.includes("Unsubscribe from announcements"));
    assert.ok(!without.text.includes("Unsubscribe from announcements"));

    const withLink = renderWelcome(
      "https://scl.test/unsubscribe?token=abc.def",
    );
    assert.ok(withLink.html.includes("Unsubscribe from announcements"));
    assert.ok(
      withLink.text.includes(
        "Unsubscribe from announcements: https://scl.test/unsubscribe?token=abc.def",
      ),
    );
  });

  it("keeps the plain-text part free of markup and blank-line runs", () => {
    const { text } = renderWelcome(
      "https://scl.test/unsubscribe?token=abc.def",
    );
    assert.ok(!/<[a-z]/i.test(text), "text part contains HTML tags");
    assert.ok(!/\n{3,}/.test(text), "text part has a run of blank lines");
  });

  it("uses the owner-approved subject", () => {
    assert.equal(
      defaultEmailTemplate("WELCOME").subject,
      "Welcome to the new Sports Cappers Leaderboard!",
    );
  });
});

describe("every shipped template is sendable", () => {
  it("places a button and uses only variables it defines", () => {
    for (const slug of Object.keys(
      EMAIL_TEMPLATES,
    ) as (keyof typeof EMAIL_TEMPLATES)[]) {
      const template = defaultEmailTemplate(slug);
      assert.ok(bodyPlacesButton(template.body), `${slug} has no {{button}}`);
      assert.deepEqual(
        unknownVariables(slug, template.body),
        [],
        `${slug} uses an undefined variable`,
      );
      assert.ok(template.subject.trim(), `${slug} has no subject`);
      assert.ok(template.actionLabel.trim(), `${slug} has no button label`);
    }
  });
});

describe("welcome email delivery point", () => {
  const read = (relative: string) =>
    fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("sends from the verify page, once the account actually works", () => {
    const source = read("src/app/(auth)/verify/page.tsx");
    assert.match(source, /sendWelcomeEmail/);
    assert.match(
      source,
      /const claimed = await consumeVerificationToken\(token\)/,
    );
    assert.match(source, /if \(claimed && !claimed\.marketingOptOut\)/);
    assert.match(source, /after\(async \(\) => \{/);
  });

  it("does not send at signup, where the account is still PENDING", () => {
    assert.doesNotMatch(
      read("src/lib/actions/signup.action.ts"),
      /sendWelcomeEmail/,
    );
  });

  it("hands the verified user's identity back so the send can be addressed", () => {
    const source = read("src/lib/tokens.ts");
    assert.match(source, /userId: string;/);
    assert.match(source, /marketingOptOut: boolean;/);
    assert.match(source, /if \(consumed\.count !== 1\) return null;/);
  });
});

describe("welcome email reaches cappers who activate via a reset link", () => {
  const read = (relative: string) =>
    fs.readFileSync(path.join(process.cwd(), relative), "utf8");

  it("treats a reset that also verifies the email as an activation", () => {
    const source = read("src/lib/password-reset-tokens.ts");
    assert.match(source, /activated: record\.user\.emailVerified === null/);
    assert.match(source, /marketingOptOut: record\.user\.marketingOptOut/);
  });

  it("sends the welcome on activation, not on a routine reset", () => {
    const source = read("src/lib/actions/password-reset.action.ts");
    assert.match(source, /sendWelcomeEmail/);
    assert.match(source, /if \(reset\.activated && !reset\.marketingOptOut\)/);
  });
});
