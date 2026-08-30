import { z } from "zod";

import { EMAIL_AUTOMATION_LIMITS } from "@/lib/email-automation";

export const emailAutomationConfigSchema = z.object({
  verificationReminderEnabled: z.boolean(),
  verificationReminderDelayHours: z.coerce
    .number()
    .int()
    .min(
      EMAIL_AUTOMATION_LIMITS.minimumVerificationDelayHours,
      "Verification reminders must wait at least 24 hours so the original link can expire.",
    )
    .max(EMAIL_AUTOMATION_LIMITS.maximumDelayHours),
  noPlaysNudgeEnabled: z.boolean(),
  noPlaysNudgeDelayHours: z.coerce
    .number()
    .int()
    .min(
      EMAIL_AUTOMATION_LIMITS.minimumNoPlaysDelayHours,
      "The no-plays follow-up must wait at least 24 hours after verification.",
    )
    .max(EMAIL_AUTOMATION_LIMITS.maximumDelayHours),
  dailyLimit: z.coerce
    .number()
    .int()
    .min(EMAIL_AUTOMATION_LIMITS.minimumDailyLimit)
    .max(
      EMAIL_AUTOMATION_LIMITS.maximumDailyLimit,
      "Keep automated mail at 50 or fewer per rolling 24 hours so account and owner email retains capacity.",
    ),
});

export type EmailAutomationConfigInput = z.infer<
  typeof emailAutomationConfigSchema
>;
