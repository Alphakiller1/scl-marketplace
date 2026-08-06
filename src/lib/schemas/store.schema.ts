import { StoreConnectionStatus } from "@prisma/client";
import { z } from "zod";

import {
  isWhopCheckoutUrl,
  whopAffiliateParamIssues,
  winibleCheckoutUrlIssues,
} from "@/lib/store-connection";
import { whopAffiliateUsername } from "@/lib/whop-config";
import {
  ADMIN_STOREFRONT_ACTIONS,
  storefrontActionRequiresReason,
} from "@/lib/storefront-review";

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

export const adminUpdateStoreConnectionSchema = z
  .object({
    connectionId: z.string().min(1),
    action: z.enum(ADMIN_STOREFRONT_ACTIONS),
    expectedStatus: z.nativeEnum(StoreConnectionStatus),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(500).optional(),
    adminNotes: z.string().trim().max(2000).optional(),
    /** Commission % agreed with the capper on Winible/Whop (0–100). */
    affiliatePercent: z.number().min(0).max(100).optional().nullable(),
  })
  .superRefine((input, context) => {
    if (
      storefrontActionRequiresReason(input.action) &&
      (!input.reason || input.reason.length < 5)
    ) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: "Add a reason of at least 5 characters",
      });
    }
    if (
      input.action === "SAVE_NOTES" &&
      input.adminNotes == null &&
      input.affiliatePercent === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["adminNotes"],
        message: "Internal notes or affiliate % are required",
      });
    }
  });

export type AdminUpdateStoreConnectionInput = z.infer<
  typeof adminUpdateStoreConnectionSchema
>;

export const adminPackageSchema = z
  .object({
    id: z.string().optional(),
    capperId: z.string().min(1),
    storeConnectionId: z.string().optional().nullable(),
    affiliateProvider: storeProviderSchema,
    title: z.string().trim().min(2).max(120),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    promoOffer: z.string().trim().max(160).optional().or(z.literal("")),
    checkoutUrl: z.string().trim().url("Enter a valid destination URL."),
    priceCents: z.number().int().min(0).max(1_000_000).default(0),
    billingPeriod: z
      .enum(["ONE_TIME", "DAY", "WEEK", "MONTH", "SEASON", "YEAR"])
      .default("MONTH"),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    if (input.affiliateProvider === "WINIBLE") {
      for (const message of winibleCheckoutUrlIssues(input.checkoutUrl)) {
        context.addIssue({
          code: "custom",
          path: ["checkoutUrl"],
          message,
        });
      }
    }
    if (input.affiliateProvider === "WHOP") {
      if (!isWhopCheckoutUrl(input.checkoutUrl)) {
        context.addIssue({
          code: "custom",
          path: ["checkoutUrl"],
          message: "Use a Whop checkout URL (https://whop.com/…).",
        });
      }
      const affiliateIssues = whopAffiliateParamIssues(
        input.checkoutUrl,
        whopAffiliateUsername(),
      );
      for (const message of affiliateIssues) {
        context.addIssue({
          code: "custom",
          path: ["checkoutUrl"],
          message,
        });
      }
    }
  });

export type AdminPackageInput = z.infer<typeof adminPackageSchema>;

export const adminPackageActiveSchema = z.object({
  packageId: z.string().min(1),
  isActive: z.boolean(),
});

export type AdminPackageActiveInput = z.infer<typeof adminPackageActiveSchema>;

export const adminPackageReorderSchema = z.object({
  packageId: z.string().min(1),
  direction: z.enum(["UP", "DOWN"]),
});

export type AdminPackageReorderInput = z.infer<
  typeof adminPackageReorderSchema
>;
