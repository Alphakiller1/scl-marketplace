import { z } from "zod";

import { SPORT_KEYS, UNIT_MAX, UNIT_MIN } from "@/lib/constants";
import {
  ALL_OUTCOMES,
  CORRECTION_REASON_MIN,
  GRADEABLE_OUTCOMES,
} from "@/lib/schemas/grading.schema";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const unitsField = z.coerce
  .number()
  .refine(
    (n) => n >= UNIT_MIN && n <= UNIT_MAX,
    `Units must be between ${UNIT_MIN} and ${UNIT_MAX}`,
  )
  .refine(
    (n) => Math.round(n * 100) % 25 === 0,
    "Units must be in 0.25 increments",
  );

export const parlayLegSchema = z.object({
  sport: z.enum(SPORT_KEYS as [string, ...string[]], {
    message: "Select a sport",
  }),
  league: optionalText(40),
  market: z.string().min(1, "Market is required").max(60),
  selection: z.string().min(1, "Selection is required").max(120),
  oddsAmerican: z.coerce
    .number()
    .int("Whole number only")
    .refine((n) => Math.abs(n) >= 100, "Use American odds (≤ -100 or ≥ +100)"),
  // Event binding — every leg is a board pick (docs/SCL_PICK_INTEGRITY.md); createParlay
  // rejects any leg missing these and verifies each one.
  eventId: optionalText(64),
  eventLabel: optionalText(160),
  eventStartsAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  side: optionalText(120),
  line: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().optional(),
  ),
  player: optionalText(120),
  // Capture book (Odds API key) at submit — historical attribution when profile books change.
  book: optionalText(40),
});

/** A parlay carries the stake; its legs are components (units live on the parlay). */
export const createParlaySchema = z
  .object({
    units: unitsField,
    packageIds: z.array(z.string().min(1)).max(10).optional().default([]),
    legs: z
      .array(parlayLegSchema)
      .min(2, "A parlay needs at least 2 legs")
      .max(12, "Up to 12 legs"),
  })
  .superRefine((value, context) => {
    const books = new Set(
      value.legs
        .map((leg) => leg.book)
        .filter((book): book is string => !!book),
    );
    if (books.size > 1) {
      context.addIssue({
        code: "custom",
        path: ["legs"],
        message: "Every parlay leg must use the same sportsbook.",
      });
    }
  });

export const gradeParlaySchema = z
  .object({
    parlayId: z.string().min(1),
    reason: optionalText(280),
    legs: z
      .array(
        z.object({
          playId: z.string().min(1),
          outcome: z.enum(GRADEABLE_OUTCOMES),
          /** Present on correction forms to reject stale leg data. */
          expectedOutcome: z.enum(ALL_OUTCOMES).optional(),
        }),
      )
      .min(1),
    /** Present on the settled-parlay detail form to reject stale corrections. */
    expectedOutcome: z.enum(ALL_OUTCOMES).optional(),
    expectedProfitUnits: z.number().finite().nullable().optional(),
    confirmedPublicImpact: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    const ids = value.legs.map((leg) => leg.playId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["legs"],
        message: "Each parlay leg can only be submitted once.",
      });
    }
    if (value.expectedOutcome === undefined) return;
    if ((value.reason?.trim().length ?? 0) < CORRECTION_REASON_MIN) {
      context.addIssue({
        code: "custom",
        path: ["reason"],
        message: `Correction reason must be at least ${CORRECTION_REASON_MIN} characters.`,
      });
    }
    if (value.confirmedPublicImpact !== true) {
      context.addIssue({
        code: "custom",
        path: ["confirmedPublicImpact"],
        message: "Confirm the public record and statistics impact.",
      });
    }
  });

export type ParlayLegInput = z.infer<typeof parlayLegSchema>;
export type CreateParlayFormInput = z.input<typeof createParlaySchema>;
export type CreateParlayInput = z.output<typeof createParlaySchema>;
export type GradeParlayInput = z.infer<typeof gradeParlaySchema>;
