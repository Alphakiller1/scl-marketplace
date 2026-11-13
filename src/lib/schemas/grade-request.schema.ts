import { z } from "zod";

import {
  GRADE_REQUEST_COMMENTARY_MAX,
  GRADE_REQUEST_COMMENTARY_MIN,
  GRADE_REQUEST_RESOLUTION_NOTE_MAX,
  GRADE_REQUEST_TYPES,
} from "@/lib/grade-requests";
import {
  ALL_OUTCOMES,
  CORRECTION_REASON_MIN,
  GRADEABLE_OUTCOMES,
} from "@/lib/schemas/grading.schema";

const id = z.string().trim().min(1).max(64);

/** What the capper's request form posts. Everything else is read from the DB. */
export const submitGradeRequestSchema = z.object({
  type: z.enum(GRADE_REQUEST_TYPES),
  kind: z.enum(["straight", "parlay"]),
  pickId: id,
  /** Parlay only: the leg the request is about. Empty = the whole ticket. */
  legId: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => value || undefined),
  commentary: z
    .string()
    .trim()
    .min(
      GRADE_REQUEST_COMMENTARY_MIN,
      `Please explain your request in at least ${GRADE_REQUEST_COMMENTARY_MIN} characters.`,
    )
    .max(
      GRADE_REQUEST_COMMENTARY_MAX,
      `Please keep your explanation under ${GRADE_REQUEST_COMMENTARY_MAX.toLocaleString("en-US")} characters.`,
    ),
});

export type SubmitGradeRequestInput = z.input<typeof submitGradeRequestSchema>;

/** Admin closes a request without (or after) applying a correction. */
export const reviewGradeRequestSchema = z
  .object({
    requestId: id,
    decision: z.enum(["RESOLVED", "DECLINED"]),
    note: z
      .string()
      .trim()
      .max(
        GRADE_REQUEST_RESOLUTION_NOTE_MAX,
        `Keep the note under ${GRADE_REQUEST_RESOLUTION_NOTE_MAX} characters.`,
      )
      .optional()
      .transform((value) => value || undefined),
  })
  .superRefine((value, context) => {
    // Declining keeps a published result the capper disputed; say why.
    if (
      value.decision === "DECLINED" &&
      (value.note?.length ?? 0) < CORRECTION_REASON_MIN
    ) {
      context.addIssue({
        code: "custom",
        path: ["note"],
        message: `Add a note of at least ${CORRECTION_REASON_MIN} characters explaining why the result stands.`,
      });
    }
  });

export type ReviewGradeRequestInput = z.input<typeof reviewGradeRequestSchema>;

/** Most plays one correction may touch — far above any real shared pick. */
export const BULK_CORRECTION_MAX_TARGETS = 500;

export const bulkCorrectionSchema = z
  .object({
    /** The pick the admin opened (straight play or parlay leg). */
    sourcePlayId: id,
    outcome: z.enum(GRADEABLE_OUTCOMES),
    reason: z
      .string()
      .trim()
      .min(
        CORRECTION_REASON_MIN,
        `Correction reason must be at least ${CORRECTION_REASON_MIN} characters.`,
      )
      .max(280, "Keep the correction reason under 280 characters."),
    confirmedPublicImpact: z.boolean(),
    /** Every play to correct, with the outcome the admin saw (stale check). */
    targets: z
      .array(
        z.object({
          playId: id,
          expectedOutcome: z.enum(ALL_OUTCOMES),
        }),
      )
      .min(1, "Select at least one play to correct.")
      .max(
        BULK_CORRECTION_MAX_TARGETS,
        `Select at most ${BULK_CORRECTION_MAX_TARGETS} plays per correction.`,
      ),
  })
  .superRefine((value, context) => {
    if (value.confirmedPublicImpact !== true) {
      context.addIssue({
        code: "custom",
        path: ["confirmedPublicImpact"],
        message: "Confirm the public record and statistics impact.",
      });
    }
    const ids = value.targets.map((target) => target.playId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["targets"],
        message: "A play was selected twice.",
      });
    }
  });

export type BulkCorrectionInput = z.input<typeof bulkCorrectionSchema>;
