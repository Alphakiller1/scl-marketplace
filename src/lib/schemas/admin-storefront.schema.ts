import { CommercePlatform, StorefrontStatus } from "@prisma/client";
import { z } from "zod";

export const adminStorefrontUpdateSchema = z.object({
  capperProfileId: z.string().min(1, "Capper profile is required"),
  commercePlatform: z.nativeEnum(CommercePlatform),
  storefrontStatus: z.nativeEnum(StorefrontStatus),
  adminNotes: z
    .string()
    .trim()
    .max(2000, "Keep internal notes under 2000 characters")
    .optional(),
});

export type AdminStorefrontUpdateInput = z.infer<
  typeof adminStorefrontUpdateSchema
>;
