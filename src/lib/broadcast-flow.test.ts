import assert from "node:assert/strict";
import test from "node:test";
import * as crypto from "node:crypto";
import { Prisma } from "@prisma/client";

import * as audience from "@/lib/admin-audience";
import * as audienceSchema from "@/lib/schemas/audience.schema";
import * as broadcast from "@/lib/broadcast";
import * as broadcastSchema from "@/lib/schemas/broadcast.schema";
import * as brevoMessageId from "@/lib/brevo-message-id";
import * as brevoSend from "@/lib/brevo-send";
import { loadTestModule } from "@/lib/test-support/load-module";
import type * as BroadcastActions from "@/lib/actions/broadcast.action";
import type * as BroadcastQueue from "@/lib/broadcast-queue";
import type * as Unsubscribe from "@/lib/unsubscribe";

const FILTERS = audienceSchema.audienceFiltersSchema.parse({
  verification: "VERIFIED",
  playHistory: "HAS_PLAYS",
  storefront: "NOT_CONNECTED",
});

function eligibleMember(id: string, email: string) {
  return {
    id,
    email,
    username: id,
    displayName: id.toUpperCase(),
    emailVerified: new Date("2026-10-01T00:00:00.000Z"),
    accountStatus: "ACTIVE",
    isTest: false,
    marketingOptOut: false,
    campaignUndeliverable: false,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    playCount: 3,
    parlayCount: 1,
    lastPlayAt: new Date("2026-10-01T00:00:00.000Z"),
    hasConnectedStorefront: false,
    storefrontAwaitingReview: false,
    eligible: true,
    ineligibleReason: null,
  };
}

test("fake capper flow previews, saves, schedules, and de-duplicates one campaign", async () => {
  const oldSecret = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = "isolated-test-secret";
  try {
    const members = [
      eligibleMember("capper-a", "a@sclmail.dev"),
      eligibleMember("capper-b", "b@sclmail.dev"),
    ];
    let savedGroup: { id: string; name: string } | null = null;
    let created: Record<string, unknown> | null = null;
    let createCount = 0;

    const prisma = {
      audienceGroup: {
        upsert: async ({ create }: { create: { name: string } }) => {
          savedGroup = { id: "group-1", name: create.name };
          return savedGroup;
        },
        findFirst: async () => savedGroup,
        deleteMany: async () => ({ count: 1 }),
      },
      adminBroadcast: {
        findUnique: async ({ where }: { where: { requestKey: string } }) =>
          created && where.requestKey === created.requestKey
            ? {
                id: "broadcast-1",
                recipientCount: 2,
                scheduledAt: created.scheduledAt,
              }
            : null,
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          createCount++;
          created = data;
          return { id: "broadcast-1" };
        },
      },
      user: { findMany: async () => [] },
    };

    const actions = loadTestModule<typeof BroadcastActions>(
      "src/lib/actions/broadcast.action.ts",
      {
        crypto,
        "@prisma/client": { Prisma },
        "next/cache": { revalidatePath: () => undefined },
        "@/lib/admin-audience": audience,
        "@/lib/after-response": { afterResponse: () => undefined },
        "@/lib/brevo": { brevoConfigured: () => true },
        "@/lib/broadcast": broadcast,
        "@/lib/broadcast-queue": {
          cancelBroadcast: async () => true,
          processBroadcastQueue: async () => ({ processed: 0 }),
        },
        "@/lib/email-image-url": {
          verifyEmailImagesDeliverable: async () => ({ ok: true }),
        },
        "@/lib/prisma": { prisma },
        "@/lib/queries/admin-audience": {
          listCampaignSuppressedAddresses: async () => new Set<string>(),
          listEligibleAudienceMembers: async () => members,
        },
        "@/lib/schemas/audience.schema": audienceSchema,
        "@/lib/schemas/broadcast.schema": broadcastSchema,
        "@/lib/session": {
          requireAdmin: async () => ({ id: "admin-1" }),
        },
      },
      { process },
    );

    const preview = await actions.previewBroadcastAudienceAction({
      audience: "FILTERED_CAPPERS",
      filters: FILTERS,
    });
    assert.equal(preview.ok, true);
    if (!preview.ok) return;
    assert.equal(preview.count, 2);
    assert.equal(preview.members.length, 2);

    const group = await actions.saveAudienceGroupAction({
      name: "Internal no-storefront test",
      filters: FILTERS,
    });
    assert.equal(group.ok, true);

    const scheduledAt = new Date(Date.now() + 24 * 60 * 60_000);
    const input = {
      audience: "FILTERED_CAPPERS" as const,
      filters: FILTERS,
      groupId: "group-1",
      subject: "Internal campaign verification",
      body: "This message only exists inside an isolated automated test.",
      confirmRecipientCount: preview.count,
      confirmFingerprint: preview.fingerprint,
      scheduledAt,
      requestKey: "internal-request-0001",
    };
    const first = await actions.sendBroadcastAction(input);
    const retried = await actions.sendBroadcastAction(input);

    assert.equal(first.ok, true);
    assert.equal(retried.ok, true);
    assert.equal(
      createCount,
      1,
      "a retried submit must not create a duplicate",
    );
    const persisted = created as Record<string, unknown> | null;
    assert.ok(persisted);
    assert.equal(persisted.provider, "BREVO");
    assert.equal(persisted.groupId, "group-1");
    assert.equal(persisted.recipientCount, 2);
    assert.equal(persisted.queuedCount, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(persisted.recipients)), {
      create: [
        { userId: "capper-a", address: "a@sclmail.dev" },
        { userId: "capper-b", address: "b@sclmail.dev" },
      ],
    });
  } finally {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
  }
});

test("fake Brevo flow sends eligible mail, suppresses opt-outs, and records provider events", async () => {
  const oldSecret = process.env.AUTH_SECRET;
  const oldBatch = process.env.BREVO_QUEUE_BATCH_SIZE;
  process.env.AUTH_SECRET = "isolated-test-secret";
  process.env.BREVO_QUEUE_BATCH_SIZE = "50";
  try {
    const now = new Date("2026-10-02T12:00:00.000Z");
    const campaign = {
      id: "broadcast-1",
      subject: "Internal lifecycle test",
      body: "Fake message body for the isolated lifecycle test.",
      audience: "FILTERED_CAPPERS",
      status: "QUEUED",
      provider: "BREVO",
      requestKey: "internal-request-0002",
      scheduledAt: new Date("2026-10-02T11:00:00.000Z"),
      createdAt: new Date("2026-10-02T10:00:00.000Z"),
      startedAt: null as Date | null,
      completedAt: null as Date | null,
      sentCount: 0,
      deliveredCount: 0,
      openedCount: 0,
      bouncedCount: 0,
      failedCount: 0,
      unsubscribedCount: 0,
      queuedCount: 2,
    };
    const recipients = [
      {
        id: "recipient-1",
        broadcastId: campaign.id,
        userId: "capper-a",
        address: "a@sclmail.dev",
        status: "QUEUED",
        providerMessageId: null as string | null,
        error: null as string | null,
        delivered: false,
        sentAt: null as Date | null,
        deliveredAt: null as Date | null,
        openedAt: null as Date | null,
        bouncedAt: null as Date | null,
        unsubscribedAt: null as Date | null,
        attempts: 0,
        createdAt: new Date("2026-10-02T10:00:00.000Z"),
        user: {
          id: "capper-a",
          email: "a@sclmail.dev",
          username: "capper-a",
          displayName: "Capper A",
          emailVerified: now,
          accountStatus: "ACTIVE",
          isTest: false,
          marketingOptOut: false,
        },
      },
      {
        id: "recipient-2",
        broadcastId: campaign.id,
        userId: "capper-b",
        address: "b@sclmail.dev",
        status: "QUEUED",
        providerMessageId: null as string | null,
        error: null as string | null,
        delivered: false,
        sentAt: null as Date | null,
        deliveredAt: null as Date | null,
        openedAt: null as Date | null,
        bouncedAt: null as Date | null,
        unsubscribedAt: null as Date | null,
        attempts: 0,
        createdAt: new Date("2026-10-02T10:00:01.000Z"),
        user: {
          id: "capper-b",
          email: "b@sclmail.dev",
          username: "capper-b",
          displayName: "Capper B",
          emailVerified: now,
          accountStatus: "ACTIVE",
          isTest: false,
          marketingOptOut: true,
        },
      },
    ];
    const providerCalls: Record<string, unknown>[] = [];
    const optedOut: string[] = [];

    const rollup = () => ({
      sent: recipients.filter((r) => r.providerMessageId).length,
      delivered: recipients.filter((r) => r.deliveredAt).length,
      opened: recipients.filter((r) => r.openedAt).length,
      bounced: recipients.filter((r) => r.bouncedAt).length,
      failed: recipients.filter((r) => r.status === "FAILED").length,
      unsubscribed: recipients.filter((r) => r.unsubscribedAt).length,
      queued: recipients.filter((r) => r.status === "QUEUED").length,
    });
    const apply = (
      row: Record<string, unknown>,
      data: Record<string, unknown>,
    ) => Object.assign(row, data);

    const prisma: Record<string, unknown> = {
      $queryRaw: async (strings: TemplateStringsArray) =>
        String(strings.raw ?? strings).includes("count(*) FILTER")
          ? [rollup()]
          : [{ locked: 1 }],
      $transaction: async (arg: unknown) =>
        typeof arg === "function"
          ? (arg as (tx: unknown) => Promise<unknown>)(prisma)
          : Promise.all(arg as Promise<unknown>[]),
      adminBroadcast: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { id?: string; status?: string };
          data: Record<string, unknown>;
        }) => {
          if (where.id && where.id !== campaign.id) return { count: 0 };
          if (where.status && where.status !== campaign.status)
            return { count: 0 };
          if (!where.id && where.status === "PROCESSING") return { count: 0 };
          apply(campaign, data);
          return { count: 1 };
        },
        findMany: async () =>
          campaign.status === "QUEUED"
            ? [{ id: campaign.id, audience: campaign.audience }]
            : [],
        findUniqueOrThrow: async () => ({
          id: campaign.id,
          subject: campaign.subject,
          body: campaign.body,
          audience: campaign.audience,
          recipients: recipients.filter((r) => r.status === "QUEUED"),
        }),
        findUnique: async () => ({
          status: campaign.status,
          completedAt: campaign.completedAt,
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          apply(campaign, data);
          return campaign;
        },
      },
      adminBroadcastRecipient: {
        count: async () => recipients.filter((r) => r.sentAt).length,
        findMany: async () => [],
        findUnique: async ({ where }: { where: { id: string } }) => {
          const row = recipients.find((r) => r.id === where.id);
          return row
            ? { status: row.status, broadcast: { status: campaign.status } }
            : null;
        },
        findFirst: async ({
          where,
        }: {
          where: { providerMessageId: string };
        }) => {
          const row = recipients.find(
            (r) => r.providerMessageId === where.providerMessageId,
          );
          return row
            ? {
                id: row.id,
                broadcastId: row.broadcastId,
                userId: row.userId,
                status: row.status,
                error: row.error,
                deliveredAt: row.deliveredAt,
                openedAt: row.openedAt,
              }
            : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id?: string; status?: string };
          data: Record<string, unknown>;
        }) => {
          const rows = recipients.filter(
            (r) =>
              (!where.id || r.id === where.id) &&
              (!where.status || r.status === where.status),
          );
          rows.forEach((r) => apply(r, data));
          return { count: rows.length };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const row = recipients.find((r) => r.id === where.id);
          assert.ok(row);
          apply(row, data);
          return row;
        },
      },
    };

    const queue = loadTestModule<typeof BroadcastQueue>(
      "src/lib/broadcast-queue.ts",
      {
        "server-only": {},
        "@/lib/app-url": { appUrl: () => "https://internal.test" },
        "@/lib/brevo": {
          brevoConfigured: () => true,
          brevoDailyLimit: () => 100,
          sendBrevoCampaignEmail: async (input: Record<string, unknown>) => {
            providerCalls.push(input);
            return { accepted: true, messageId: "message-1" };
          },
        },
        "@/lib/brevo-message-id": brevoMessageId,
        "@/lib/brevo-send": brevoSend,
        "@/lib/broadcast": broadcast,
        "@/lib/email": {
          renderBroadcastHtml: ({
            body,
            unsubscribeUrl,
          }: {
            body: string;
            unsubscribeUrl?: string;
          }) => `${body}\n${unsubscribeUrl ?? ""}`,
        },
        "@/lib/email-image-url": { emailImageUrlResolver: () => undefined },
        "@/lib/prisma": { prisma },
        "@/lib/queries/admin-audience": {
          listCampaignSuppressedAddresses: async () => new Set<string>(),
        },
        "@/lib/unsubscribe": {
          applyMarketingOptOut: async (userId: string) => optedOut.push(userId),
        },
      },
      { process },
    );

    const result = await queue.processBroadcastQueue(now);
    assert.equal(
      result.processed,
      1,
      JSON.stringify({ result, campaign, recipients, providerCalls }),
    );
    assert.equal(providerCalls.length, 1);
    assert.match(String(providerCalls[0]?.html), /\/unsubscribe\?token=/);
    assert.equal(recipients[0]?.status, "SENT");
    assert.equal(recipients[0]?.providerMessageId, "message-1");
    assert.equal(recipients[1]?.status, "UNSUBSCRIBED");
    assert.equal(campaign.status, "COMPLETED");

    assert.equal(
      await queue.applyBrevoWebhookEvent({
        event: "delivered",
        "message-id": "<message-1>",
        ts_event: now.getTime() / 1000,
      }),
      true,
    );
    assert.equal(recipients[0]?.status, "DELIVERED");
    assert.equal(
      await queue.applyBrevoWebhookEvent({
        event: "unique_opened",
        "message-id": "message-1",
        ts_event: now.getTime() / 1000,
      }),
      true,
    );
    assert.equal(recipients[0]?.status, "OPENED");
    assert.equal(
      await queue.applyBrevoWebhookEvent({
        event: "unsubscribed",
        "message-id": "message-1",
        ts_event: now.getTime() / 1000,
      }),
      true,
    );
    assert.equal(recipients[0]?.status, "UNSUBSCRIBED");
    assert.deepEqual(optedOut, ["capper-a"]);
    assert.equal(campaign.deliveredCount, 1);
    assert.equal(campaign.openedCount, 1);
    assert.equal(campaign.unsubscribedCount, 2);
  } finally {
    if (oldSecret === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = oldSecret;
    if (oldBatch === undefined) delete process.env.BREVO_QUEUE_BATCH_SIZE;
    else process.env.BREVO_QUEUE_BATCH_SIZE = oldBatch;
  }
});

test("unsubscribe atomically opts out and withdraws only queued mass mail", async () => {
  const calls: { user?: unknown; recipients?: unknown } = {};
  const prisma = {
    user: {
      update: async (input: unknown) => {
        calls.user = input;
        return {};
      },
    },
    adminBroadcastRecipient: {
      updateMany: async (input: unknown) => {
        calls.recipients = input;
        return { count: 2 };
      },
    },
    $transaction: async (promises: Promise<unknown>[]) => Promise.all(promises),
  };
  const unsubscribe = loadTestModule<typeof Unsubscribe>(
    "src/lib/unsubscribe.ts",
    {
      "server-only": {},
      "@/lib/broadcast": broadcast,
      "@/lib/prisma": { prisma },
    },
    { process },
  );
  const at = new Date("2026-10-02T12:00:00.000Z");
  await unsubscribe.applyMarketingOptOut("capper-a", at);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), {
    user: {
      where: { id: "capper-a" },
      data: { marketingOptOut: true },
    },
    recipients: {
      where: {
        userId: "capper-a",
        status: "QUEUED",
        broadcast: { audience: { not: "SINGLE_CAPPER" } },
      },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: "2026-10-02T12:00:00.000Z",
      },
    },
  });
});
