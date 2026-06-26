import { z } from "zod";

import { SPORT_KEYS, UNIT_MIN, UNIT_MAX } from "@/lib/constants";

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
      (n) => n >= UNIT_MIN && n <= UNIT_MAX,
      `Units must be between ${UNIT_MIN} and ${UNIT_MAX}`,
    )
    .refine(
      (n) => Math.round(n * 100) % 25 === 0,
      "Units must be in 0.25 increments",
    ),
  notes: optionalText(280),
});

// Input = pre-coercion (what the form holds); Output = post-validation (DB-ready).
export type PlayFormInput = z.input<typeof playSchema>;
export type PlayInput = z.output<typeof playSchema>;
