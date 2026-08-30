import { prisma } from "@/lib/prisma";
import {
  isSystemEmailActivityType,
  systemEmailActivityCutoff,
} from "@/lib/system-email-activity-policy";

export type SystemEmailActivityInput = {
  emailType: string;
  recipientEmail: string;
  recipientUsername?: string | null;
  status: "SENT" | "FAILED";
  providerMessageId?: string | null;
  failureReason?: string | null;
  createdAt?: Date;
};

function normalizeUsername(username?: string | null): string | null {
  const value = username?.trim().replace(/^@/, "");
  return value || null;
}

/**
 * Delivery reporting must never become a reason an email fails. This writer is
 * deliberately best-effort and stores recipient snapshots rather than a user
 * relation, preserving the historical row through renames and account removal.
 */
export async function recordSystemEmailActivities(
  inputs: readonly SystemEmailActivityInput[],
  now = new Date(),
): Promise<void> {
  if (inputs.length === 0) return;

  // Runtime defense for JavaScript callers and stale compiled code. The type
  // prevents new TypeScript call sites from expanding this ledger by accident.
  const automatedInputs = inputs.filter((input) =>
    isSystemEmailActivityType(input.emailType),
  );
  if (automatedInputs.length === 0) return;

  try {
    const unresolvedEmails = [
      ...new Set(
        automatedInputs
          .filter((input) => !normalizeUsername(input.recipientUsername))
          .map((input) => input.recipientEmail.trim().toLowerCase()),
      ),
    ];
    const matchingUsers = unresolvedEmails.length
      ? await prisma.user.findMany({
          where: { email: { in: unresolvedEmails, mode: "insensitive" } },
          select: { email: true, username: true },
        })
      : [];
    const usernamesByEmail = new Map(
      matchingUsers.map((user) => [
        user.email.trim().toLowerCase(),
        normalizeUsername(user.username),
      ]),
    );

    await prisma.$transaction([
      prisma.systemEmailActivity.deleteMany({
        where: { createdAt: { lt: systemEmailActivityCutoff(now) } },
      }),
      prisma.systemEmailActivity.createMany({
        data: automatedInputs.map((input) => ({
          emailType: input.emailType,
          recipientUsername:
            normalizeUsername(input.recipientUsername) ??
            usernamesByEmail.get(input.recipientEmail.trim().toLowerCase()) ??
            null,
          recipientEmail: input.recipientEmail.trim().toLowerCase(),
          status: input.status,
          providerMessageId: input.providerMessageId ?? null,
          failureReason: input.failureReason?.slice(0, 500) ?? null,
          createdAt: input.createdAt ?? now,
        })),
      }),
    ]);
  } catch (error) {
    console.error("[email-activity] could not record delivery", error);
  }
}

export async function recordSystemEmailActivity(
  input: SystemEmailActivityInput,
  now = new Date(),
): Promise<void> {
  await recordSystemEmailActivities([input], now);
}

/** Called by the hourly lifecycle scheduler even when both jobs are disabled. */
export async function pruneSystemEmailActivity(
  now = new Date(),
): Promise<void> {
  try {
    await prisma.systemEmailActivity.deleteMany({
      where: { createdAt: { lt: systemEmailActivityCutoff(now) } },
    });
  } catch (error) {
    console.error("[email-activity] retention cleanup unavailable", error);
  }
}
