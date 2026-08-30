import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  SYSTEM_EMAIL_ACTIVITY_TYPES,
  SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS,
  isSystemEmailActivityType,
  systemEmailActivityCutoff,
} from "@/lib/system-email-activity-policy";

const read = (relative: string) =>
  fs.readFileSync(path.join(process.cwd(), relative), "utf8");

describe("system email activity retention", () => {
  it("keeps exactly the requested rolling 14-day window", () => {
    const now = new Date("2026-08-30T16:00:00.000Z");
    assert.equal(SYSTEM_EMAIL_ACTIVITY_RETENTION_DAYS, 14);
    assert.equal(
      systemEmailActivityCutoff(now).toISOString(),
      "2026-08-16T16:00:00.000Z",
    );
  });

  it("persists recipient snapshots and indexes the chronological query", () => {
    const schema = read("prisma/schema.prisma");
    const migration = read(
      "prisma/migrations/20260830120000_system_email_activity/migration.sql",
    );
    const activityModel = /model SystemEmailActivity \{([\s\S]*?)\n\}/.exec(
      schema,
    )?.[1];
    assert.ok(activityModel);
    assert.match(schema, /model SystemEmailActivity/);
    assert.match(activityModel, /recipientUsername String\?/);
    assert.match(activityModel, /recipientEmail\s+String/);
    assert.doesNotMatch(activityModel, /subject|body/i);
    assert.match(migration, /SystemEmailActivity_createdAt_idx/);
    assert.doesNotMatch(activityModel, /user\s+User/);
  });
});

describe("system email activity flow", () => {
  it("allows only SCL lifecycle automations into the activity ledger", () => {
    const email = read("src/lib/email.ts");
    assert.deepEqual(SYSTEM_EMAIL_ACTIVITY_TYPES, [
      "WELCOME",
      "VERIFY_EMAIL_REMINDER",
      "NO_PLAYS_NUDGE",
    ]);
    for (const type of SYSTEM_EMAIL_ACTIVITY_TYPES) {
      assert.equal(isSystemEmailActivityType(type), true);
    }
    for (const excluded of [
      "VERIFICATION",
      "PASSWORD_RESET",
      "ADMIN_BROADCAST",
      "STOREFRONT_MESSAGE",
    ]) {
      assert.equal(isSystemEmailActivityType(excluded), false);
    }
    assert.match(email, /recordSystemEmailActivity\(\{/);
    assert.match(email, /emailType: input\.slug/);
    assert.match(email, /providerMessageId: data\?\.id/);
  });

  it("cannot turn a reporting failure into an email failure", () => {
    const writer = read("src/lib/system-email-activity.ts");
    assert.match(writer, /try \{/);
    assert.match(writer, /catch \(error\)/);
    assert.match(writer, /could not record delivery/);
  });

  it("queries newest-first and cleans up while automations are disabled", () => {
    const query = read("src/lib/queries/system-email-activity.ts");
    const runner = read("src/lib/email-automation-runner.ts");
    assert.match(
      query,
      /createdAt: \{ gte: systemEmailActivityCutoff\(now\) \}/,
    );
    assert.match(
      query,
      /emailType: \{ in: \[\.\.\.SYSTEM_EMAIL_ACTIVITY_TYPES\] \}/,
    );
    assert.match(query, /orderBy: \[\{ createdAt: "desc" \}/);
    assert.match(runner, /await pruneSystemEmailActivity\(now\)/);
  });

  it("renders the requested fields in a scrollable grouped ledger", () => {
    const page = read("src/app/(admin)/admin/emails/page.tsx");
    const component = read("src/components/scl/recent-email-activity.tsx");
    for (const label of [
      "Date/time",
      "Email type",
      "Capper username",
      "Email address",
      "Status",
    ]) {
      assert.match(component, new RegExp(label));
    }
    assert.match(page, /Recent Email Activity/);
    assert.match(page, /row\.status === "SENT"/);
    assert.match(page, /Automated emails sent/);
    assert.match(page, /Last 14 days · provider accepted/);
    assert.match(component, /max-h-\[42rem\] overflow-y-auto/);
    assert.match(component, /return "Today"/);
    assert.match(component, /return "Yesterday"/);
  });
});
