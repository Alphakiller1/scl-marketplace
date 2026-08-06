import { z } from "zod";
import { BetType, DailyVolume, Outcome, ProviderType } from "@prisma/client";

/**
 * Contract for importing cappers from the legacy SCL platform.
 *
 * Kept free of app path-aliases (only `zod` + Prisma enums) so the import
 * script can load it directly under tsx. See docs/LEGACY_MIGRATION.md.
 */

/**
 * Mirror of `LEGACY_PASSWORD_FORMATS` in `src/lib/legacy-password.ts`, inlined
 * because this file stays free of path-aliases (the import script loads it
 * directly). `legacy-password.test.ts` asserts the two stay in step.
 */
export const LEGACY_PASSWORD_FORMATS = [
  "BCRYPT",
  "PHPASS",
  "MD5",
  "SHA1",
  "SHA256",
  "PLAINTEXT",
] as const;

export const legacyPlaySchema = z
  .object({
    sport: z.string().min(1),
    league: z.string().optional(),
    // The fixture a bare pick belongs to. Without these an imported
    // "Over 7 total" names no game and can never be graded.
    homeTeam: z.string().max(60).optional(),
    awayTeam: z.string().max(60).optional(),
    market: z.string().min(1),
    selection: z.string().min(1),
    oddsAmerican: z.number().int(),
    units: z.number().positive(),
    outcome: z.nativeEnum(Outcome),
    /** Optional — computed from odds/units when omitted (except PENDING). */
    profitUnits: z.number().optional(),
    gradedAt: z.coerce.date().optional(),
    createdAt: z.coerce.date().optional(),
  })
  .superRefine((p, ctx) => {
    // Settled plays must carry a real timestamp; otherwise the importer would
    // fall back to the import run's `now`, collapsing historical chronology and
    // corrupting leaderboard streaks/recent form (which sort by gradedAt ?? createdAt).
    if (p.outcome !== Outcome.PENDING && !p.gradedAt && !p.createdAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gradedAt"],
        message:
          "Settled plays must include gradedAt or createdAt so historical results sort correctly.",
      });
    }
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
  /** Legacy `cappers_profiles.bet_vol` — how much a capper releases per day. */
  dailyVolume: z.nativeEnum(DailyVolume).optional(),
  /** Legacy `cappers_profiles.big_win` — free text, e.g. "25 Units". */
  biggestBetWon: z.string().max(120).optional(),
  /** Marks the imported record as verified (emailVerified) on the new platform. */
  verified: z.boolean().optional(),
  /**
   * The capper's credential exactly as the previous platform stored it, so they
   * can sign in with the password they already had. Verified once at login, then
   * re-hashed with bcrypt and discarded (`src/lib/legacy-password.ts`).
   */
  passwordHash: z.string().min(1).max(255).optional(),
  /**
   * Format hint for `passwordHash`; detected from the hash shape when omitted.
   * `PLAINTEXT` is never detected, so an export carrying bare passwords must
   * declare it.
   */
  passwordFormat: z.enum(LEGACY_PASSWORD_FORMATS).optional(),
  instagram: z.string().optional(),
  twitter: z.string().optional(),
  facebook: z.string().optional(),
  tiktok: z.string().optional(),
  website: z.string().optional(),
  plays: z.array(legacyPlaySchema).optional(),
});

export const legacyImportSchema = z
  .array(legacyCapperSchema)
  .superRefine((cappers, ctx) => {
    // Each entry resolves to a unique user key (email, or the username@legacy.scl
    // placeholder). Duplicates would silently merge two export records into one
    // identity — overwriting profile data and skipping the second entry's plays.
    const seen = new Map<string, number>();
    cappers.forEach((c, i) => {
      const email = (c.email ?? `${c.username}@legacy.scl`).toLowerCase();
      const first = seen.get(email);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "email"],
          message: `Duplicate import email "${email}" (also used by entry ${first}); each capper must resolve to a unique email.`,
        });
      } else {
        seen.set(email, i);
      }
    });
  });

export type LegacyPlayInput = z.infer<typeof legacyPlaySchema>;
export type LegacyCapperInput = z.infer<typeof legacyCapperSchema>;
export type LegacyImport = z.infer<typeof legacyImportSchema>;
