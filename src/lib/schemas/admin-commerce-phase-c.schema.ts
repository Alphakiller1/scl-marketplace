import { SaleSource, SaleStatus } from "@prisma/client";
import { z } from "zod";

export const recordPackageSaleSchema = z.object({
  packageId: z.string().min(1),
  customerUserId: z.string().optional(),
  clickEventId: z.string().optional(),
  source: z.nativeEnum(SaleSource),
  status: z.nativeEnum(SaleStatus).default("REPORTED"),
  grossCents: z.coerce.number().int().min(0).max(10_000_000),
  affiliatePercent: z.coerce.number().int().min(0).max(100).optional(),
  externalOrderId: z.string().trim().max(120).optional(),
  purchasedAt: z.string().datetime().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const updatePackageSaleStatusSchema = z.object({
  saleId: z.string().min(1),
  status: z.nativeEnum(SaleStatus),
});

export const updatePlatformCommerceSchema = z.object({
  nativeStoreEnabled: z.boolean(),
  platformAffiliatePercent: z.coerce.number().int().min(0).max(100),
});

export const updateCapperCommerceSchema = z.object({
  capperProfileId: z.string().min(1),
  nativeStoreEnabled: z.boolean(),
  defaultAffiliatePercent: z.coerce
    .number()
    .int()
    .min(0)
    .max(100)
    .nullable()
    .optional(),
});

export type RecordPackageSaleInput = z.infer<typeof recordPackageSaleSchema>;
export type UpdatePackageSaleStatusInput = z.infer<
  typeof updatePackageSaleStatusSchema
>;
export type UpdatePlatformCommerceInput = z.infer<
  typeof updatePlatformCommerceSchema
>;
export type UpdateCapperCommerceInput = z.infer<
  typeof updateCapperCommerceSchema
>;

export const SALE_SOURCE_LABEL: Record<SaleSource, string> = {
  MANUAL: "Manual entry",
  WINIBLE: "Winible",
  WHOP: "Whop",
  SCL_NATIVE: "SCL native store",
};

export const SALE_STATUS_LABEL: Record<SaleStatus, string> = {
  REPORTED: "Reported",
  CONFIRMED: "Confirmed",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
};
