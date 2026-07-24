import { BillingPeriod, PackageVisibility } from "@prisma/client";
import { z } from "zod";

const urlSchema = z
  .string()
  .trim()
  .url("Enter a valid checkout URL")
  .max(500, "Checkout URL is too long");

export const adminPackageUpsertSchema = z.object({
  id: z.string().optional(),
  capperProfileId: z.string().min(1, "Capper profile is required"),
  title: z.string().trim().min(2, "Title is required").max(80),
  description: z
    .string()
    .trim()
    .max(500, "Keep the description under 500 characters")
    .optional(),
  priceCents: z.coerce.number().int().min(0).max(1_000_000),
  billingPeriod: z.nativeEnum(BillingPeriod),
  checkoutUrl: urlSchema.optional().or(z.literal("")),
  trialTerms: z
    .string()
    .trim()
    .max(200, "Keep trial terms under 200 characters")
    .optional(),
  displayOrder: z.coerce.number().int().min(0).max(999),
  visibility: z.nativeEnum(PackageVisibility),
  affiliatePercent: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .nullable(),
});

export const adminPackageDeleteSchema = z.object({
  packageId: z.string().min(1),
});

export type AdminPackageUpsertInput = z.infer<typeof adminPackageUpsertSchema>;
export type AdminPackageDeleteInput = z.infer<typeof adminPackageDeleteSchema>;
