import { z } from "zod";

/** Outcomes an admin can assign when grading (PENDING is the pre-grade state). */
export const GRADEABLE_OUTCOMES = ["WIN", "LOSS", "PUSH", "VOID"] as const;

export const gradePlaySchema = z.object({
  playId: z.string().min(1),
  outcome: z.enum(GRADEABLE_OUTCOMES),
  reason: z
    .string()
    .max(280)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
});

export type GradePlayInput = z.infer<typeof gradePlaySchema>;
