import "server-only";

import {
  EMAIL_AUTOMATION_CONFIG_ID,
  EMAIL_AUTOMATION_DEFAULTS,
  rollingDayStart,
} from "@/lib/email-automation";
import { prisma } from "@/lib/prisma";

export type EmailAutomationConfigView = {
  verificationReminderEnabled: boolean;
  verificationReminderDelayHours: number;
  verificationReminderActivatedAt: Date | null;
  noPlaysNudgeEnabled: boolean;
  noPlaysNudgeDelayHours: number;
  noPlaysNudgeActivatedAt: Date | null;
  dailyLimit: number;
  storageReady: boolean;
  updatedAt: Date | null;
};

export async function getEmailAutomationConfig(): Promise<EmailAutomationConfigView> {
  try {
    const row = await prisma.emailAutomationConfig.findUnique({
      where: { id: EMAIL_AUTOMATION_CONFIG_ID },
    });
    return {
      ...EMAIL_AUTOMATION_DEFAULTS,
      ...row,
      storageReady: true,
      updatedAt: row?.updatedAt ?? null,
    };
  } catch (error) {
    console.error("[email-automation] config storage unavailable", error);
    return {
      ...EMAIL_AUTOMATION_DEFAULTS,
      storageReady: false,
      updatedAt: null,
    };
  }
}

export async function getEmailAutomationActivity(now = new Date()) {
  try {
    const [sentRollingDay, capacityUsedRollingDay, recentRuns, recentFailures] =
      await Promise.all([
        prisma.emailAutomationDelivery.count({
          where: { status: "SENT", sentAt: { gte: rollingDayStart(now) } },
        }),
        prisma.emailAutomationDelivery.count({
          where: {
            status: { in: ["PROCESSING", "SENT", "FAILED"] },
            claimedAt: { gte: rollingDayStart(now) },
          },
        }),
        prisma.emailAutomationRun.findMany({
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            startedAt: true,
            finishedAt: true,
            attempted: true,
            sent: true,
            failed: true,
            skipped: true,
            error: true,
          },
        }),
        prisma.emailAutomationDelivery.findMany({
          where: { status: "FAILED" },
          orderBy: { failedAt: "desc" },
          take: 5,
          select: {
            id: true,
            automationKey: true,
            failedAt: true,
            lastError: true,
            user: { select: { username: true, email: true } },
          },
        }),
      ]);
    return {
      sentRollingDay,
      capacityUsedRollingDay,
      recentRuns,
      recentFailures,
      storageReady: true,
    };
  } catch (error) {
    console.error("[email-automation] activity storage unavailable", error);
    return {
      sentRollingDay: 0,
      capacityUsedRollingDay: 0,
      recentRuns: [],
      recentFailures: [],
      storageReady: false,
    };
  }
}
