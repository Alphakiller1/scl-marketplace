import { z } from "zod";

export const storeProviderSchema = z.enum(["WINIBLE", "WHOP"]);

export const submitStoreConnectionSchema = z.object({
  provider: storeProviderSchema,
  acknowledged: z
    .boolean()
    .refine((v) => v === true, { message: "Acknowledgment is required." }),
});

export type SubmitStoreConnectionInput = z.infer<
  typeof submitStoreConnectionSchema
>;

export const markInstructionsViewedSchema = z.object({
  provider: storeProviderSchema,
});

export const adminUpdateStoreConnectionSchema = z.object({
  connectionId: z.string().min(1),
  action: z.enum(["LINKS_RECEIVED", "NEEDS_ACTION", "DISABLED", "LIVE"]),
  adminNotes: z.string().max(2000).optional(),
});

export type AdminUpdateStoreConnectionInput = z.infer<
  typeof adminUpdateStoreConnectionSchema
>;

export const adminPackageSchema = z.object({
  id: z.string().optional(),
  capperId: z.string().min(1),
  storeConnectionId: z.string().optional().nullable(),
  affiliateProvider: storeProviderSchema,
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  checkoutUrl: z.string().trim().url("Enter a valid destination URL."),
  priceCents: z.number().int().min(0).max(1_000_000).default(0),
  billingPeriod: z
    .enum(["ONE_TIME", "DAY", "WEEK", "MONTH", "SEASON", "YEAR"])
    .default("MONTH"),
  isActive: z.boolean().default(false),
});

export type AdminPackageInput = z.infer<typeof adminPackageSchema>;
