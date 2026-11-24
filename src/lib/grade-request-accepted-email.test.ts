import assert from "node:assert/strict";
import test from "node:test";

import * as gradeRequests from "@/lib/grade-requests";
import { defaultEmailTemplate, unknownVariables } from "@/lib/email-templates";
import { renderEmailTemplate } from "@/lib/email-template-render";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as Resolution from "@/lib/grade-request-resolution";

/** Values built inside the VM context carry foreign prototypes. */
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

type StoredRequest = {
  id: string;
  type: "REGRADE" | "INJURY_PROTECTION";
  pickSummary: string;
  outcomeAtRequest: "WIN" | "LOSS" | "PUSH" | "VOID";
  profitUnitsAtRequest: number | null;
  resolvedAt: Date | null;
  play: { outcome: string; profitUnits: number | null } | null;
  parlay: { outcome: string; profitUnits: number | null } | null;
  capper: { user: { email: string; username: string | null } };
};

const jabari: StoredRequest = {
  id: "req_jabari",
  type: "REGRADE",
  pickSummary:
    "Jabari Smith Jr Over 4.5 Rebounds · Houston Rockets @ Atlanta Hawks · -295 · 1U",
  outcomeAtRequest: "LOSS",
  profitUnitsAtRequest: -1,
  resolvedAt: new Date("2026-11-24T15:00:00Z"),
  play: { outcome: "WIN", profitUnits: 0.34 },
  parlay: null,
  capper: { user: { email: "boots@example.com", username: "bootstobets" } },
};

function harness(
  options: {
    stored?: StoredRequest[];
    closedIds?: string[];
    updateFails?: boolean;
    delivered?: boolean;
  } = {},
) {
  const scheduled: (() => Promise<unknown>)[] = [];
  const sent: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];
  const resolution = loadTestModule<typeof Resolution>(
    "src/lib/grade-request-resolution.ts",
    {
      "server-only": {},
      "next/server": {
        after: (task: () => Promise<unknown>) => {
          scheduled.push(task);
        },
      },
      "@/lib/account-claim": {
        hasDeliverableEmail: (email: string) =>
          !email.endsWith("@legacy.invalid"),
      },
      "@/lib/email": {
        sendGradeRequestAcceptedEmail: async (
          input: Record<string, unknown>,
        ) => {
          sent.push(input);
          return { delivered: options.delivered ?? true };
        },
      },
      "@/lib/grade-requests": gradeRequests,
      "@/lib/prisma": {
        prisma: {
          gradeRequest: {
            updateManyAndReturn: async (args: Record<string, unknown>) => {
              updates.push(args);
              if (options.updateFails) throw new Error("db down");
              return (options.closedIds ?? []).map((id) => ({ id }));
            },
            findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
              (options.stored ?? [jabari]).filter((row) =>
                where.id.in.includes(row.id),
              ),
          },
        },
      },
    },
  );
  const runScheduled = async () => {
    for (const task of scheduled.splice(0)) await task();
  };
  return { resolution, scheduled, sent, updates, runScheduled };
}

test("a correction that closes a request emails that capper after the response", async () => {
  const { resolution, scheduled, sent, runScheduled } = harness({
    closedIds: ["req_jabari"],
  });
  const count = await resolution.resolveGradeRequestsForPicks({
    playIds: ["play_1"],
    parlayIds: [],
    adminId: "admin_1",
    note: "WIN applied: ESPN box score 5 REB",
  });
  assert.equal(count, 1);
  // Nothing is sent inside the admin's save; it waits for `after`.
  assert.equal(sent.length, 0);
  assert.equal(scheduled.length, 1);

  await runScheduled();
  assert.equal(sent.length, 1);
  const email = plain(sent[0]!);
  assert.equal(email.to, "boots@example.com");
  assert.equal(email.type, "REGRADE");
  assert.equal(email.requestId, "req_jabari");
  assert.deepEqual(email.variables, {
    "{{account}}": "Account: @bootstobets",
    "{{pick}}":
      "Jabari Smith Jr Over 4.5 Rebounds · Houston Rockets @ Atlanta Hawks · -295 · 1U",
    "{{previous_result}}": "Loss · -1U",
    "{{result}}": "Win · +0.34U",
  });
});

test("only the requests this correction closed are emailed", async () => {
  // Nothing was still OPEN: an admin closed it by hand first, and that path
  // sends its own email.
  const { resolution, scheduled } = harness({ closedIds: [] });
  const count = await resolution.resolveGradeRequestsForPicks({
    playIds: ["play_1"],
    parlayIds: [],
    adminId: "admin_1",
    note: "WIN applied",
  });
  assert.equal(count, 0);
  assert.equal(scheduled.length, 0);
});

test("a failed close sends nothing and never throws into grading", async () => {
  const { resolution, scheduled } = harness({
    closedIds: ["req_jabari"],
    updateFails: true,
  });
  const count = await resolution.resolveGradeRequestsForPicks({
    playIds: ["play_1"],
    parlayIds: [],
    adminId: "admin_1",
    note: "WIN applied",
  });
  assert.equal(count, 0);
  assert.equal(scheduled.length, 0);
});

test("a parlay request reports the ticket's result, whichever leg was named", async () => {
  const leg: StoredRequest = {
    ...jabari,
    id: "req_leg",
    type: "INJURY_PROTECTION",
    pickSummary: "2-Leg Parlay +264 · 1U — Leg 2: George Pickens Over 59.5",
    play: { outcome: "VOID", profitUnits: 0 },
    parlay: { outcome: "WIN", profitUnits: 0.67 },
  };
  const { resolution, sent } = harness({ stored: [leg] });
  assert.equal(await resolution.sendAcceptedRequestEmails(["req_leg"]), 1);
  const email = plain(sent[0]!);
  assert.equal(email.type, "INJURY_PROTECTION");
  assert.equal(
    (email.variables as Record<string, string>)["{{result}}"],
    "Win · +0.67U",
  );
});

test("no email for a placeholder address, a reopened request, or a deleted pick", async () => {
  const placeholder = {
    ...jabari,
    id: "req_legacy",
    capper: { user: { email: "old@legacy.invalid", username: null } },
  };
  const reopened = { ...jabari, id: "req_reopened", resolvedAt: null };
  const orphan = { ...jabari, id: "req_orphan", play: null };
  const { resolution, sent } = harness({
    stored: [placeholder, reopened, orphan],
  });
  assert.equal(
    await resolution.sendAcceptedRequestEmails([
      "req_legacy",
      "req_reopened",
      "req_orphan",
    ]),
    0,
  );
  assert.equal(sent.length, 0);
});

test("both accepted templates render the pick facts and pass their own guardrails", () => {
  const variables = gradeRequests.gradeRequestAcceptedVariables({
    username: "bootstobets",
    pickSummary: jabari.pickSummary,
    outcomeAtRequest: "LOSS",
    profitUnitsAtRequest: -1,
    outcome: "WIN",
    profitUnits: 0.34,
  });
  for (const type of gradeRequests.GRADE_REQUEST_TYPES) {
    const slug = gradeRequests.GRADE_REQUEST_ACCEPTED_TEMPLATE[type];
    const template = defaultEmailTemplate(slug);
    assert.deepEqual(unknownVariables(slug, template.body), []);
    const { html, text } = renderEmailTemplate({
      body: template.body,
      actionLabel: template.actionLabel,
      actionUrl: "https://sportscappersleaderboard.com/dashboard/picks",
      footnote: template.footnote,
      variables,
      imageUrl: () => null,
    });
    assert.match(text, /Account: @bootstobets/);
    assert.match(text, /Before: Loss · -1U/);
    assert.match(text, /Now: Win · \+0\.34U/);
    assert.match(html, /dashboard\/picks/);
    assert.doesNotMatch(text, /\{\{/, `${slug} left a token unfilled`);
  }
});
