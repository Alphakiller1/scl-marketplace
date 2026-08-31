import { z } from "zod";

import { ODDS_CONTROL_SPORTS } from "@/lib/odds-control";

/**
 * `maxEvents` value meaning "every event on the slate".
 *
 * The provider caps a slate well below this, so it is a ceiling rather than a
 * literal count. It exists as a named constant because the number itself was
 * surfacing in the UI — the form told owners to "use 99 for the entire
 * available slate", which asks a person to remember a magic number to express
 * the most ordinary intent the form has.
 */
export const ALL_SLATE_EVENTS = 99;

export const verificationScheduleInputSchema = z
  .object({
    name: z.string().trim().min(3).max(80),
    sport: z.enum(ODDS_CONTROL_SPORTS),
    scope: z.enum(["SLATE", "LEAGUE"]),
    league: z.string().trim().max(100).optional().default(""),
    coverage: z.enum(["SURFACE", "CONFIGURED", "ALL"]),
    maxEvents: z.number().int().min(1).max(ALL_SLATE_EVENTS),
    recurrence: z.enum(["ONCE", "RECURRING"]),
    date: z.string().trim().optional().default(""),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7),
  })
  .superRefine((value, context) => {
    if (value.scope === "LEAGUE" && !value.league) {
      context.addIssue({
        code: "custom",
        path: ["league"],
        message: "Choose or enter a league for a league-only verification.",
      });
    }
    if (value.scope === "SLATE" && value.league) {
      context.addIssue({
        code: "custom",
        path: ["league"],
        message: "A whole-slate schedule cannot also select one league.",
      });
    }
    if (
      value.recurrence === "ONCE" &&
      !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
    ) {
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Choose the Eastern date for this one-time verification.",
      });
    }
    if (new Set(value.daysOfWeek).size !== value.daysOfWeek.length) {
      context.addIssue({
        code: "custom",
        path: ["daysOfWeek"],
        message: "A recurring day cannot be selected twice.",
      });
    }
    if (value.recurrence === "RECURRING" && value.daysOfWeek.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["daysOfWeek"],
        message: "Select at least one recurring weekday.",
      });
    }
  });

export type VerificationScheduleInput = z.infer<
  typeof verificationScheduleInputSchema
>;
