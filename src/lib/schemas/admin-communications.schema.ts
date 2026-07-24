import { BulkEmailAudience, EmailRecipientKind } from "@prisma/client";
import { z } from "zod";

export const bulkCapperEmailSchema = z.object({
  subject: z.string().trim().min(3, "Subject is required").max(120),
  bodyHtml: z
    .string()
    .trim()
    .min(10, "Message body is required")
    .max(50_000, "Message body is too long"),
  audience: z.nativeEnum(BulkEmailAudience),
});

export const bulkEmailSchema = bulkCapperEmailSchema.extend({
  recipientKind: z.nativeEnum(EmailRecipientKind),
});

export type BulkCapperEmailInput = z.infer<typeof bulkCapperEmailSchema>;
export type BulkEmailInput = z.infer<typeof bulkEmailSchema>;

export const BULK_EMAIL_AUDIENCE_LABEL: Record<BulkEmailAudience, string> = {
  ALL_CAPPERS: "All capper accounts",
  ACTIVE_CAPPERS: "Active capper accounts",
  VERIFIED_CAPPERS: "Email-verified cappers",
  STOREFRONT_LIVE: "Live storefront cappers",
  NEEDS_ATTENTION: "Storefronts flagged needs attention",
  ALL_CUSTOMERS: "All customer accounts",
  ACTIVE_CUSTOMERS: "Active customer accounts",
  MARKETING_OPT_IN_CUSTOMERS: "Marketing opt-in customers",
};

export const CAPPER_EMAIL_AUDIENCES: BulkEmailAudience[] = [
  "ALL_CAPPERS",
  "ACTIVE_CAPPERS",
  "VERIFIED_CAPPERS",
  "STOREFRONT_LIVE",
  "NEEDS_ATTENTION",
];

export const CUSTOMER_EMAIL_AUDIENCES: BulkEmailAudience[] = [
  "ALL_CUSTOMERS",
  "ACTIVE_CUSTOMERS",
  "MARKETING_OPT_IN_CUSTOMERS",
];
