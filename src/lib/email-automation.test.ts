import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  EMAIL_AUTOMATION_DEFAULTS,
  EMAIL_AUTOMATION_LIMITS,
  eligibilityCutoff,
  nextAutomationActivationAt,
  remainingAutomationCapacity,
  retryAt,
  rollingDayStart,
} from "@/lib/email-automation";
import { emailAutomationConfigSchema } from "@/lib/schemas/email-automation.schema";
import { deriveAutomationVerificationToken } from "@/lib/tokens";

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("email automation policy", () => {
  it("ships off and cannot create a historical blast by default", () => {
    assert.equal(EMAIL_AUTOMATION_DEFAULTS.verificationReminderEnabled, false);
    assert.equal(EMAIL_AUTOMATION_DEFAULTS.noPlaysNudgeEnabled, false);
    assert.equal(
      EMAIL_AUTOMATION_DEFAULTS.verificationReminderActivatedAt,
      null,
    );
    assert.equal(EMAIL_AUTOMATION_DEFAULTS.noPlaysNudgeActivatedAt, null);
  });

  it("computes delay, rolling-window, retry, and remaining capacity exactly", () => {
    const now = new Date("2026-08-29T16:00:00.000Z");
    assert.equal(
      eligibilityCutoff(now, 72).toISOString(),
      "2026-08-26T16:00:00.000Z",
    );
    assert.equal(
      rollingDayStart(now).toISOString(),
      "2026-08-28T16:00:00.000Z",
    );
    assert.equal(
      retryAt(now).getTime() - now.getTime(),
      EMAIL_AUTOMATION_LIMITS.retryDelayMs,
    );
    assert.equal(remainingAutomationCapacity(25, 8), 17);
    assert.equal(remainingAutomationCapacity(25, 30), 0);
  });

  it("requires safe waits and reserves at least half the 100-message allowance", () => {
    assert.equal(
      emailAutomationConfigSchema.safeParse({
        verificationReminderEnabled: true,
        verificationReminderDelayHours: 23,
        noPlaysNudgeEnabled: true,
        noPlaysNudgeDelayHours: 72,
        dailyLimit: 25,
      }).success,
      false,
    );
    assert.equal(
      emailAutomationConfigSchema.safeParse({
        verificationReminderEnabled: true,
        verificationReminderDelayHours: 24,
        noPlaysNudgeEnabled: true,
        noPlaysNudgeDelayHours: 24,
        dailyLimit: 51,
      }).success,
      false,
    );
  });

  it("keeps the verification link stable across idempotent retries", () => {
    const first = deriveAutomationVerificationToken(
      "user-1",
      "delivery-1",
      "test-secret",
    );
    const retry = deriveAutomationVerificationToken(
      "user-1",
      "delivery-1",
      "test-secret",
    );
    assert.equal(first, retry);
    assert.notEqual(
      first,
      deriveAutomationVerificationToken("user-1", "delivery-2", "test-secret"),
    );
    assert.notEqual(
      first,
      deriveAutomationVerificationToken("user-2", "delivery-1", "test-secret"),
    );
  });

  it("starts a fresh cohort only when a rule becomes active", () => {
    const current = new Date("2026-08-01T00:00:00.000Z");
    const now = new Date("2026-08-29T00:00:00.000Z");
    assert.equal(
      nextAutomationActivationAt({
        wasEnabled: false,
        enabled: true,
        current,
        now,
      }),
      now,
    );
    assert.equal(
      nextAutomationActivationAt({
        wasEnabled: true,
        enabled: true,
        current,
        now,
      }),
      current,
    );
    assert.equal(
      nextAutomationActivationAt({
        wasEnabled: true,
        enabled: false,
        current,
        now,
      }),
      current,
    );
    assert.equal(
      nextAutomationActivationAt({
        wasEnabled: true,
        enabled: true,
        current: null,
        now,
      }),
      now,
    );
  });
});

describe("email automation wiring", () => {
  it("has a protected hourly scheduler", () => {
    const route = read("src/app/api/cron/email-automations/route.ts");
    const vercel = JSON.parse(read("vercel.json")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    assert.match(route, /process\.env\.CRON_SECRET/);
    assert.match(route, /authorization === `Bearer \$\{secret\}`/);
    assert.match(route, /status: result\.ok \? 200 : 503/);
    assert.deepEqual(
      vercel.crons.find((cron) => cron.path === "/api/cron/email-automations"),
      { path: "/api/cron/email-automations", schedule: "17 * * * *" },
    );
  });

  it("enforces deduplication, retry bounds, cohort boundaries, and play checks", () => {
    const runner = read("src/lib/email-automation-runner.ts");
    const action = read("src/lib/actions/email-automation.action.ts");
    const migration = read(
      "prisma/migrations/20260829140000_email_automations/migration.sql",
    );

    assert.match(
      migration,
      /UNIQUE INDEX "EmailAutomationDelivery_automationKey_userId_key"/,
    );
    assert.match(runner, /idempotencyKey = `scl-lifecycle-\$\{deliveryId\}`/);
    assert.match(
      runner,
      /attemptCount: \{ lt: EMAIL_AUTOMATION_LIMITS\.maximumAttempts \}/,
    );
    assert.match(runner, /plays: \{ none: \{\} \}/);
    assert.match(runner, /parlays: \{ none: \{\} \}/);
    assert.match(runner, /marketingOptOut: false/);
    assert.match(runner, /isTest: false/);
    assert.match(runner, /isLegacy: false/);
    assert.match(runner, /hasFreshUserRequestedVerificationLink/);
    assert.match(runner, /createAutomationVerificationToken/);
    assert.match(runner, /Reserved or placeholder email address/);
    assert.match(action, /nextAutomationActivationAt/);
    assert.match(action, /const mailer = await probeMailer\(\)/);
    assert.match(action, /mailer\.deliverable === false/);
  });

  it("makes readiness and unsaved state obvious to owners", () => {
    const page = read("src/app/(admin)/admin/emails/page.tsx");
    const controls = read(
      "src/components/scl/admin-email-automation-controls.tsx",
    );
    const layout = read("src/app/(admin)/layout.tsx");

    assert.match(page, /probeMailer\(\)/);
    assert.match(page, /nativeButton=\{false\}/);
    assert.match(controls, /Mailer needs attention/);
    assert.match(controls, /Unsaved changes — nothing is live yet/);
    assert.match(controls, /All automation settings are saved/);
    assert.match(controls, /mailerBlocksEnable/);
    assert.match(layout, /Email Cappers/);
  });

  it("keeps owner-editable copy and the correct secure destinations", () => {
    const templates = read("src/lib/email-templates.ts");
    const mail = read("src/lib/email.ts");
    assert.match(templates, /"VERIFY_EMAIL_REMINDER"/);
    assert.match(templates, /"NO_PLAYS_NUDGE"/);
    assert.match(mail, /slug: "VERIFY_EMAIL_REMINDER"/);
    assert.match(mail, /\/verify\?token=\$\{input\.token\}/);
    assert.match(mail, /slug: "NO_PLAYS_NUDGE"/);
    assert.match(mail, /\/dashboard\/picks\/new/);
    assert.match(mail, /marketingFooter\(input\.unsubscribeUrl\)/);
  });
});
