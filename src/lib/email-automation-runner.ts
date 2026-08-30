import { Prisma } from "@prisma/client";

import { hasDeliverableEmail } from "@/lib/account-claim";
import { appUrl } from "@/lib/app-url";
import { signUnsubscribeToken } from "@/lib/broadcast";
import {
  sendNoPlaysNudgeEmail,
  sendVerificationReminderEmail,
} from "@/lib/email";
import {
  EMAIL_AUTOMATION_LIMITS,
  EMAIL_AUTOMATION_LOCK_KEY,
  eligibilityCutoff,
  remainingAutomationCapacity,
  retryAt,
  rollingDayStart,
  type EmailAutomationKey,
} from "@/lib/email-automation";
import { createAutomationVerificationToken } from "@/lib/tokens";
import { prisma } from "@/lib/prisma";
import { getEmailAutomationConfig } from "@/lib/queries/email-automations";
import { pruneSystemEmailActivity } from "@/lib/system-email-activity";

type Candidate = {
  id: string;
  email: string;
  username: string | null;
  createdAt: Date;
};
type Claimed = { id: string; attemptCount: number };

const candidateSelect = {
  id: true,
  email: true,
  username: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

async function acquireRunLock(runId: string, now: Date): Promise<boolean> {
  await prisma.emailAutomationLock.upsert({
    where: { key: EMAIL_AUTOMATION_LOCK_KEY },
    create: {
      key: EMAIL_AUTOMATION_LOCK_KEY,
      lockedBy: null,
      lockedUntil: now,
    },
    update: {},
  });
  const lock = await prisma.emailAutomationLock.updateMany({
    where: {
      key: EMAIL_AUTOMATION_LOCK_KEY,
      OR: [{ lockedUntil: { lte: now } }, { lockedBy: runId }],
    },
    data: {
      lockedBy: runId,
      lockedUntil: new Date(now.getTime() + EMAIL_AUTOMATION_LIMITS.lockMs),
    },
  });
  return lock.count === 1;
}

async function releaseRunLock(runId: string) {
  await prisma.emailAutomationLock.updateMany({
    where: { key: EMAIL_AUTOMATION_LOCK_KEY, lockedBy: runId },
    data: { lockedBy: null, lockedUntil: new Date(0) },
  });
}

async function claimDelivery(
  automationKey: EmailAutomationKey,
  userId: string,
  now: Date,
): Promise<Claimed | null> {
  try {
    return await prisma.emailAutomationDelivery.create({
      data: { automationKey, userId, claimedAt: now },
      select: { id: true, attemptCount: true },
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    ) {
      throw error;
    }
  }

  const existing = await prisma.emailAutomationDelivery.findUnique({
    where: { automationKey_userId: { automationKey, userId } },
    select: {
      id: true,
      status: true,
      attemptCount: true,
      claimedAt: true,
      nextAttemptAt: true,
    },
  });
  if (
    !existing ||
    existing.attemptCount >= EMAIL_AUTOMATION_LIMITS.maximumAttempts
  ) {
    return null;
  }

  const failedReady =
    existing.status === "FAILED" &&
    Boolean(existing.nextAttemptAt && existing.nextAttemptAt <= now);
  const staleProcessing =
    existing.status === "PROCESSING" &&
    existing.claimedAt <=
      new Date(now.getTime() - EMAIL_AUTOMATION_LIMITS.staleClaimMs);
  if (!failedReady && !staleProcessing) return null;

  const claimed = await prisma.emailAutomationDelivery.updateMany({
    where: {
      id: existing.id,
      status: existing.status,
      attemptCount: existing.attemptCount,
    },
    data: {
      status: "PROCESSING",
      attemptCount: { increment: 1 },
      claimedAt: now,
      nextAttemptAt: null,
      failedAt: null,
      lastError: null,
    },
  });
  return claimed.count === 1
    ? { id: existing.id, attemptCount: existing.attemptCount + 1 }
    : null;
}

async function findCandidates(
  key: EmailAutomationKey,
  activatedAt: Date,
  cutoff: Date,
  take: number,
): Promise<Candidate[]> {
  const retryableDelivery = {
    OR: [
      { automatedEmails: { none: { automationKey: key } } },
      {
        automatedEmails: {
          some: {
            automationKey: key,
            status: "FAILED",
            attemptCount: { lt: EMAIL_AUTOMATION_LIMITS.maximumAttempts },
            nextAttemptAt: { lte: new Date() },
          },
        },
      },
      {
        automatedEmails: {
          some: {
            automationKey: key,
            status: "PROCESSING",
            attemptCount: { lt: EMAIL_AUTOMATION_LIMITS.maximumAttempts },
            claimedAt: {
              lte: new Date(Date.now() - EMAIL_AUTOMATION_LIMITS.staleClaimMs),
            },
          },
        },
      },
    ],
  } satisfies Prisma.UserWhereInput;

  const shared = {
    role: "CAPPER" as const,
    isTest: false,
    createdAt: { gte: activatedAt },
    capperProfile: { is: { isLegacy: false } },
    ...retryableDelivery,
  } satisfies Prisma.UserWhereInput;

  const rows = await prisma.user.findMany({
    where:
      key === "VERIFY_EMAIL_REMINDER"
        ? {
            ...shared,
            accountStatus: { in: ["PENDING", "ACTIVE"] },
            emailVerified: null,
            createdAt: { gte: activatedAt, lte: cutoff },
          }
        : {
            ...shared,
            accountStatus: "ACTIVE",
            emailVerified: { not: null, lte: cutoff },
            marketingOptOut: false,
            capperProfile: {
              is: {
                isLegacy: false,
                plays: { none: {} },
                parlays: { none: {} },
              },
            },
          },
    select: candidateSelect,
    orderBy: { createdAt: "asc" },
    take,
  });
  return rows;
}

async function stillEligible(key: EmailAutomationKey, userId: string) {
  return Boolean(
    await prisma.user.findFirst({
      where:
        key === "VERIFY_EMAIL_REMINDER"
          ? {
              id: userId,
              role: "CAPPER",
              isTest: false,
              emailVerified: null,
              accountStatus: { in: ["PENDING", "ACTIVE"] },
            }
          : {
              id: userId,
              role: "CAPPER",
              isTest: false,
              accountStatus: "ACTIVE",
              emailVerified: { not: null },
              marketingOptOut: false,
              capperProfile: {
                is: {
                  isLegacy: false,
                  plays: { none: {} },
                  parlays: { none: {} },
                },
              },
            },
      select: { id: true },
    }),
  );
}

async function hasFreshUserRequestedVerificationLink(
  candidate: Candidate,
  now: Date,
) {
  // Signup creates the first token immediately. Anything created more than
  // five minutes later is a capper-initiated resend; do not invalidate that
  // fresh link with an automated replacement.
  const issuedAfterSignup = new Date(
    candidate.createdAt.getTime() + 5 * 60_000,
  );
  return Boolean(
    await prisma.verificationToken.findFirst({
      where: {
        identifier: candidate.id,
        createdAt: { gt: issuedAfterSignup },
        expires: { gt: now },
      },
      select: { token: true },
    }),
  );
}

async function deliver(
  key: EmailAutomationKey,
  candidate: Candidate,
  deliveryId: string,
) {
  const idempotencyKey = `scl-lifecycle-${deliveryId}`;
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new Error("AUTH_SECRET is required for secure lifecycle links.");
  }
  if (key === "VERIFY_EMAIL_REMINDER") {
    const token = await createAutomationVerificationToken(
      candidate.id,
      deliveryId,
      secret,
    );
    return sendVerificationReminderEmail({
      email: candidate.email,
      username: candidate.username,
      token,
      idempotencyKey,
    });
  }

  return sendNoPlaysNudgeEmail({
    email: candidate.email,
    username: candidate.username,
    unsubscribeUrl: `${appUrl()}/unsubscribe?token=${signUnsubscribeToken(candidate.id, secret)}`,
    idempotencyKey,
  });
}

export async function runEmailAutomations(now = new Date()) {
  await pruneSystemEmailActivity(now);
  const config = await getEmailAutomationConfig();
  if (!config.storageReady) {
    throw new Error("Email automation tables are unavailable.");
  }
  const anyRuleActive =
    (config.verificationReminderEnabled &&
      Boolean(config.verificationReminderActivatedAt)) ||
    (config.noPlaysNudgeEnabled && Boolean(config.noPlaysNudgeActivatedAt));
  if (!anyRuleActive) {
    return { ok: true, disabled: true, attempted: 0, sent: 0 };
  }

  const run = await prisma.emailAutomationRun.create({ data: {} });
  const locked = await acquireRunLock(run.id, now);
  if (!locked) {
    await prisma.emailAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "SKIPPED",
        finishedAt: new Date(),
        skipped: 1,
        error: "Another email automation run is active.",
      },
    });
    return { ok: true, runId: run.id, overlapPrevented: true, sent: 0 };
  }

  let attempted = 0;
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  try {
    const capacityUsedInRollingDay = await prisma.emailAutomationDelivery.count(
      {
        where: {
          status: { in: ["PROCESSING", "SENT", "FAILED"] },
          claimedAt: { gte: rollingDayStart(now) },
        },
      },
    );
    let capacity = remainingAutomationCapacity(
      config.dailyLimit,
      capacityUsedInRollingDay,
    );

    const rules: Array<{
      key: EmailAutomationKey;
      enabled: boolean;
      delayHours: number;
      activatedAt: Date | null;
    }> = [
      {
        key: "VERIFY_EMAIL_REMINDER",
        enabled: config.verificationReminderEnabled,
        delayHours: config.verificationReminderDelayHours,
        activatedAt: config.verificationReminderActivatedAt,
      },
      {
        key: "NO_PLAYS_NUDGE",
        enabled: config.noPlaysNudgeEnabled,
        delayHours: config.noPlaysNudgeDelayHours,
        activatedAt: config.noPlaysNudgeActivatedAt,
      },
    ];

    for (const rule of rules) {
      if (!rule.enabled || !rule.activatedAt || capacity <= 0) continue;
      const candidates = await findCandidates(
        rule.key,
        rule.activatedAt,
        eligibilityCutoff(now, rule.delayHours),
        Math.min(capacity * 4, 200),
      );

      for (const candidate of candidates) {
        if (capacity <= 0) break;
        const claim = await claimDelivery(rule.key, candidate.id, now);
        if (!claim) continue;
        attempted += 1;

        // Persist the skip so an old placeholder cannot sit at the front of
        // the candidate page forever and starve real addresses behind it.
        if (!hasDeliverableEmail(candidate.email)) {
          skipped += 1;
          await prisma.emailAutomationDelivery.update({
            where: { id: claim.id },
            data: {
              status: "SKIPPED",
              lastError: "Reserved or placeholder email address.",
            },
          });
          continue;
        }

        if (
          rule.key === "VERIFY_EMAIL_REMINDER" &&
          (await hasFreshUserRequestedVerificationLink(candidate, now))
        ) {
          skipped += 1;
          await prisma.emailAutomationDelivery.update({
            where: { id: claim.id },
            data: {
              status: "SKIPPED",
              lastError: "Capper already requested a fresh verification link.",
            },
          });
          continue;
        }

        if (!(await stillEligible(rule.key, candidate.id))) {
          skipped += 1;
          await prisma.emailAutomationDelivery.update({
            where: { id: claim.id },
            data: {
              status: "SKIPPED",
              lastError: "Recipient no longer meets the rule.",
            },
          });
          continue;
        }

        // Reserve this slot before touching the provider. An ambiguous network
        // failure may still have been accepted upstream, so counting only a
        // confirmed response could exceed the owner's cap.
        capacity -= 1;
        try {
          const result = await deliver(rule.key, candidate, claim.id);
          if (!result.delivered) {
            throw new Error("Email provider did not accept the message.");
          }
          sent += 1;
          await prisma.emailAutomationDelivery.update({
            where: { id: claim.id },
            data: {
              status: "SENT",
              sentAt: new Date(),
              nextAttemptAt: null,
              failedAt: null,
              lastError: null,
            },
          });
        } catch (error) {
          failed += 1;
          const message =
            error instanceof Error ? error.message : "Unexpected send failure";
          await prisma.emailAutomationDelivery.update({
            where: { id: claim.id },
            data: {
              status: "FAILED",
              failedAt: new Date(),
              nextAttemptAt:
                claim.attemptCount < EMAIL_AUTOMATION_LIMITS.maximumAttempts
                  ? retryAt(now)
                  : null,
              lastError: message.slice(0, 1000),
            },
          });
        }
      }
    }

    await prisma.emailAutomationRun.update({
      where: { id: run.id },
      data: {
        status: failed > 0 ? "COMPLETED_WITH_ERRORS" : "SUCCEEDED",
        finishedAt: new Date(),
        attempted,
        sent,
        failed,
        skipped,
      },
    });
    return {
      ok: failed === 0,
      runId: run.id,
      attempted,
      sent,
      failed,
      skipped,
      remainingCapacity: capacity,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Run failed";
    await prisma.emailAutomationRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        attempted,
        sent,
        failed,
        skipped,
        error: message.slice(0, 1000),
      },
    });
    throw error;
  } finally {
    await releaseRunLock(run.id);
  }
}
