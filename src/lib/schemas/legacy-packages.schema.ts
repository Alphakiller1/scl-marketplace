import { z } from "zod";
import { BillingPeriod, StoreProvider } from "@prisma/client";

/**
 * Contract for importing storefront packages carried over from the legacy SCL
 * platform (`aff_subscriptions`), where each row is one affiliate checkout offer.
 *
 * Kept free of app path-aliases (only `zod` + Prisma enums) so the import
 * script can load it directly under tsx. See docs/LEGACY_MIGRATION.md.
 */

export const legacyPackageSchema = z.object({
  /** Must match a User.username created by the capper import. */
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  /**
   * The legacy affiliate code (unique per offer). Keys the idempotent upsert
   * and the /go tracking slug, so re-running never duplicates an offer or
   * invalidates a link that has already been shared.
   */
  legacyRef: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, dashes and underscores only"),
  title: z.string().min(1).max(100),
  description: z.string().max(600).nullish(),
  /**
   * 0 means "do not display a price". The legacy copy sometimes quotes several
   * figures ("$25 now just $12.50!"), and showing the wrong one is worse than
   * showing none — the checkout page remains authoritative.
   */
  priceCents: z.number().int().nonnegative(),
  billingPeriod: z.nativeEnum(BillingPeriod),
  /** Required: a package with no checkout URL can never publish. */
  checkoutUrl: z.string().url(),
  affiliateProvider: z.nativeEnum(StoreProvider).nullish(),
  sortOrder: z.number().int().nonnegative(),
  isActive: z.boolean(),
});

export const legacyPackagesImportSchema = z
  .array(legacyPackageSchema)
  .superRefine((packages, ctx) => {
    const seen = new Map<string, number>();
    packages.forEach((p, i) => {
      const key = p.legacyRef.toLowerCase();
      const first = seen.get(key);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "legacyRef"],
          message: `Duplicate legacyRef "${p.legacyRef}" (also at ${first}); it keys the tracking slug and must be unique.`,
        });
      } else {
        seen.set(key, i);
      }
    });
  });

export type LegacyPackageInput = z.infer<typeof legacyPackageSchema>;
export type LegacyPackagesImport = z.infer<typeof legacyPackagesImportSchema>;

/** Deterministic /go slug for a carried-over offer. */
export function legacyPackageSlug(username: string, legacyRef: string): string {
  return `${username}-${legacyRef}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
