import { StoreConnectionStatus } from "@prisma/client";
import { z } from "zod";

import {
  isWhopCheckoutUrl,
  isWhopCreatorReferralUrl,
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
    /**
     * How many periods one term covers: 4 + DAY is a 4-day pass.
     *
     * Capped at 365 so the unit still carries the meaning — "500 months" is a
     * data-entry slip, not an offer, and the label it renders is public.
     */
    billingIntervalCount: z
      .number()
      .int("Whole units only.")
      .min(1, "A term is at least one unit long.")
      .max(365, "That term is too long — use a larger unit instead.")
      .default(1),
    sortOrder: z.number().int().min(0).max(10_000).default(0),
    isActive: z.boolean().default(false),
  })
  .superRefine((input, context) => {
    // A count is meaningless for these two — "3 one time" is not an offer, and a
    // season is a season. Reject rather than silently coercing, so the form says
    // what it did instead of quietly changing the operator's input.
    if (
      (input.billingPeriod === "ONE_TIME" ||
        input.billingPeriod === "SEASON") &&
      input.billingIntervalCount !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["billingIntervalCount"],
        message:
          input.billingPeriod === "ONE_TIME"
            ? "A one-time package has no repeat count."
            : "A season package has no repeat count.",
      });
    }
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
      // The creator referral gets its own message from whopAffiliateParamIssues
      // below; the generic hint would only muddy it (it *is* a whop.com URL).
      if (
        !isWhopCheckoutUrl(input.checkoutUrl) &&
        !isWhopCreatorReferralUrl(input.checkoutUrl)
      ) {
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

/**
 * Deleting a package cascades to its tracking URLs (and their click history)
 * and to the play/parlay attribution rows. `confirmDestructive` is the admin
 * saying they know that: the action refuses without it whenever a package has
 * history worth keeping, so "tidy up a duplicate" can never quietly erase a
 * capper's package results. Hiding remains the non-destructive option.
 */
export const adminPackageDeleteSchema = z.object({
  packageId: z.string().min(1),
  confirmDestructive: z.boolean().optional(),
});

export type AdminPackageDeleteInput = z.infer<typeof adminPackageDeleteSchema>;

export const adminPackageReorderSchema = z.object({
  packageId: z.string().min(1),
  direction: z.enum(["UP", "DOWN"]),
});

export type AdminPackageReorderInput = z.infer<
  typeof adminPackageReorderSchema
>;
