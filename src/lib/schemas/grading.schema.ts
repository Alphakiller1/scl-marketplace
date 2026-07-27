import { z } from "zod";

/** Outcomes an admin can assign when grading (PENDING is the pre-grade state). */
export const GRADEABLE_OUTCOMES = ["WIN", "LOSS", "PUSH", "VOID"] as const;
export const ALL_OUTCOMES = ["PENDING", ...GRADEABLE_OUTCOMES] as const;
export const CORRECTION_REASON_MIN = 5;

export const gradePlaySchema = z
  .object({
    playId: z.string().min(1),
    outcome: z.enum(GRADEABLE_OUTCOMES),
    reason: z
      .string()
      .max(280)
      .optional()
      .or(z.literal(""))
      .transform((value) => value?.trim() || undefined),
    /** Present on the settled-play detail form to reject stale corrections. */
    expectedOutcome: z.enum(ALL_OUTCOMES).optional(),
    expectedProfitUnits: z.number().finite().nullable().optional(),
    confirmedPublicImpact: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.expectedOutcome === undefined) return;
    if ((value.reason?.length ?? 0) < CORRECTION_REASON_MIN) {
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

export type GradePlayInput = z.infer<typeof gradePlaySchema>;
