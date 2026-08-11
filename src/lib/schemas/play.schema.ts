import { z } from "zod";

import {
  PREDICTION_UNIT_MAX,
  PREDICTION_UNIT_MIN,
  SPORT_KEYS,
} from "@/lib/constants";
import { isValidPredictionUnits } from "@/lib/prediction-units";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

export const playSchema = z.object({
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
  units: z.coerce
    .number()
    .refine(
      (n) => n >= PREDICTION_UNIT_MIN && n <= PREDICTION_UNIT_MAX,
      `Units must be between ${PREDICTION_UNIT_MIN} and ${PREDICTION_UNIT_MAX}`,
    )
    .refine(isValidPredictionUnits, "Units can have at most 2 decimal places"),
  notes: optionalText(1000),
  notesPublic: z.boolean().optional().default(true),
  packageIds: z.array(z.string().min(1)).max(10).optional().default([]),

  // Pick-integrity binding
  // supplies them for the strict/verified path; a legacy free-text pick omits them and lands as
  // SELF_REPORTED. The server never trusts these — it re-derives the lock and re-fetches odds.
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

// Input = pre-coercion (what the form holds); Output = post-validation (DB-ready).
export type PlayFormInput = z.input<typeof playSchema>;
export type PlayInput = z.output<typeof playSchema>;
