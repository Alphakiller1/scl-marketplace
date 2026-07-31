import { z } from "zod";
import { LegacyRecordScope } from "@prisma/client";

/**
 * Contract for importing carried-over aggregate results from the legacy SCL
 * platform, which pruned individual picks on a rolling 90-day basis and kept
 * only these totals beyond that.
 *
 * Kept free of app path-aliases (only `zod` + Prisma enums) so the import
 * script can load it directly under tsx. See docs/LEGACY_MIGRATION.md.
 */

/** Sentinel for the combined (all-sports) total, matching LeaderboardFilters. */
export const LEGACY_RECORD_ALL_SPORTS = "ALL";

export const legacyRecordEntrySchema = z
  .object({
    scope: z.nativeEnum(LegacyRecordScope),
    /** A canonical SPORT_KEY, or "ALL" for the combined total. */
    sport: z.string().min(1).max(20),
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    pushes: z.number().int().nonnegative(),
    /** Risk-denominated, matching the legacy convention (ROI = net / risked). */
    unitsRisked: z.number().nonnegative(),
    unitsNet: z.number(),
  })
  .superRefine((r, ctx) => {
    if (r.wins + r.losses + r.pushes === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wins"],
        message:
          "A record with no settled results is noise — omit it rather than storing a zero row.",
      });
    }
    // A settled record always risked something. Zero risk with real results
    // means the source totals were mismatched, which would silently produce an
    // infinite/zero ROI on the leaderboard.
    if (r.unitsRisked === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unitsRisked"],
        message:
          "Settled records must carry the units risked so ROI is computable.",
      });
    }
  });

export const legacyRecordCapperSchema = z
  .object({
    /** Must match a User.username already imported by the capper import. */
    username: z
      .string()
      .min(3)
      .max(30)
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    /** When the legacy export these totals came from was taken. */
    capturedAt: z.coerce.date(),
    records: z.array(legacyRecordEntrySchema).min(1),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    c.records.forEach((r, i) => {
      const key = `${r.scope}:${r.sport}`;
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["records", i, "scope"],
          message: `Duplicate ${key} for @${c.username}; each scope/sport pair must appear once.`,
        });
      }
      seen.add(key);
    });
  });

export const legacyRecordsImportSchema = z
  .array(legacyRecordCapperSchema)
  .superRefine((cappers, ctx) => {
    const seen = new Map<string, number>();
    cappers.forEach((c, i) => {
      const handle = c.username.toLowerCase();
      const first = seen.get(handle);
      if (first !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "username"],
          message: `Duplicate entry for @${c.username} (also at ${first}); merge them before importing.`,
        });
      } else {
        seen.set(handle, i);
      }
    });
  });

export type LegacyRecordEntry = z.infer<typeof legacyRecordEntrySchema>;
export type LegacyRecordCapper = z.infer<typeof legacyRecordCapperSchema>;
export type LegacyRecordsImport = z.infer<typeof legacyRecordsImportSchema>;
