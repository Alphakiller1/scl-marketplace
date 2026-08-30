"use server";

import { revalidatePath } from "next/cache";

import {
  EMAIL_AUTOMATION_CONFIG_ID,
  nextAutomationActivationAt,
} from "@/lib/email-automation";
import { probeMailer } from "@/lib/email-deliverability";
import { prisma } from "@/lib/prisma";
import {
  emailAutomationConfigSchema,
  type EmailAutomationConfigInput,
} from "@/lib/schemas/email-automation.schema";
import { requireAdmin } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

export async function saveEmailAutomationConfigAction(
  input: EmailAutomationConfigInput,
): Promise<Result> {
  const admin = await requireAdmin();
  const parsed = emailAutomationConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ?? "Check the automation settings.",
    };
  }

  try {
    const current = await prisma.emailAutomationConfig.findUnique({
      where: { id: EMAIL_AUTOMATION_CONFIG_ID },
    });
    const now = new Date();
    const next = parsed.data;
    if (next.verificationReminderEnabled || next.noPlaysNudgeEnabled) {
      const mailer = await probeMailer();
      if (mailer.deliverable === false) {
        return {
          ok: false,
          error: `Email delivery is not ready: ${mailer.reason ?? "check the Resend configuration"}. You can keep both automations off while it is repaired.`,
        };
      }
    }
    const verificationReminderActivatedAt = nextAutomationActivationAt({
      wasEnabled: current?.verificationReminderEnabled ?? false,
      enabled: next.verificationReminderEnabled,
      current: current?.verificationReminderActivatedAt ?? null,
      now,
    });
    const noPlaysNudgeActivatedAt = nextAutomationActivationAt({
      wasEnabled: current?.noPlaysNudgeEnabled ?? false,
      enabled: next.noPlaysNudgeEnabled,
      current: current?.noPlaysNudgeActivatedAt ?? null,
      now,
    });
    await prisma.emailAutomationConfig.upsert({
      where: { id: EMAIL_AUTOMATION_CONFIG_ID },
      create: {
        id: EMAIL_AUTOMATION_CONFIG_ID,
        ...next,
        verificationReminderActivatedAt,
        noPlaysNudgeActivatedAt,
        updatedById: admin.id,
      },
      update: {
        ...next,
        // Each off → on transition creates a clean cohort boundary. Pausing for
        // a month must not unleash a month-old backlog when an owner resumes.
        verificationReminderActivatedAt,
        noPlaysNudgeActivatedAt,
        updatedById: admin.id,
      },
    });
    revalidatePath("/admin/emails");
    return { ok: true };
  } catch (error) {
    console.error("[email-automation] config save failed", error);
    return {
      ok: false,
      error:
        "Could not save automation settings. Nothing was enabled or changed.",
    };
  }
}
