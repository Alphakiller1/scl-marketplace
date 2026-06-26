import { z } from "zod";
import { BetType, Outcome, ProviderType } from "@prisma/client";

/**
 * Contract for importing cappers from the legacy SCL platform.
 *
 * Kept free of app path-aliases (only `zod` + Prisma enums) so the import
 * script can load it directly under tsx. See docs/LEGACY_MIGRATION.md.
 */

export const legacyPlaySchema = z.object({
  sport: z.string().min(1),
  league: z.string().optional(),
  market: z.string().min(1),
  selection: z.string().min(1),
  oddsAmerican: z.number().int(),
  units: z.number().positive(),
  outcome: z.nativeEnum(Outcome),
  /** Optional — computed from odds/units when omitted (except PENDING). */
  profitUnits: z.number().optional(),
  gradedAt: z.coerce.date().optional(),
  createdAt: z.coerce.date().optional(),
});

export const legacyCapperSchema = z.object({
  /** Becomes User.username — the public /cappers/[handle] slug. */
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
  displayName: z.string().min(1).max(60),
  /** Optional — a placeholder (username@legacy.scl) is used when omitted. */
  email: z.string().email().optional(),
  headline: z.string().max(160).optional(),
  bio: z.string().max(800).optional(),
  avatarUrl: z.string().url().optional(),
  sports: z.array(z.string()).optional(),
  specialties: z.array(z.string()).optional(),
  betTypes: z.array(z.nativeEnum(BetType)).optional(),
  providerType: z.nativeEnum(ProviderType).optional(),
  /** Marks the imported record as verified (emailVerified) on the new platform. */
  verified: z.boolean().optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
  plays: z.array(legacyPlaySchema).optional(),
});

export const legacyImportSchema = z.array(legacyCapperSchema);

export type LegacyPlayInput = z.infer<typeof legacyPlaySchema>;
export type LegacyCapperInput = z.infer<typeof legacyCapperSchema>;
export type LegacyImport = z.infer<typeof legacyImportSchema>;
