import "server-only";

import { EMAIL_TEMPLATES, isEmailTemplateSlug } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";
import {
  SYSTEM_EMAIL_ACTIVITY_TYPES,
  systemEmailActivityCutoff,
} from "@/lib/system-email-activity-policy";

function emailTypeLabel(emailType: string): string {
  if (isEmailTemplateSlug(emailType)) return EMAIL_TEMPLATES[emailType].label;
  return emailType;
}

export async function getRecentSystemEmailActivity(now = new Date()) {
  try {
    const rows = await prisma.systemEmailActivity.findMany({
      where: {
        createdAt: { gte: systemEmailActivityCutoff(now) },
        emailType: { in: [...SYSTEM_EMAIL_ACTIVITY_TYPES] },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        emailType: true,
        recipientUsername: true,
        recipientEmail: true,
        status: true,
        failureReason: true,
        createdAt: true,
      },
    });
    return {
      storageReady: true,
      rows: rows.map((row) => ({
        ...row,
        emailTypeLabel: emailTypeLabel(row.emailType),
      })),
    };
  } catch (error) {
    console.error("[email-activity] recent activity unavailable", error);
    return { storageReady: false, rows: [] };
  }
}

export type RecentSystemEmailActivity = Awaited<
  ReturnType<typeof getRecentSystemEmailActivity>
>["rows"][number];
