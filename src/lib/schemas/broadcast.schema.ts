import { z } from "zod";

export const broadcastAudienceSchema = z.enum([
  "ALL_CAPPERS",
  "VERIFIED_CAPPERS",
  "SINGLE_CAPPER",
]);

export const broadcastSchema = z
  .object({
    audience: broadcastAudienceSchema,
    /** Required when audience is SINGLE_CAPPER; ignored otherwise. */
    userId: z.string().min(1).optional(),
    subject: z
      .string()
      .trim()
      .min(3, "Give the message a subject.")
      .max(150, "Keep the subject under 150 characters."),
    body: z
      .string()
      .trim()
      .min(10, "Write a message.")
      .max(10_000, "Keep the message under 10,000 characters."),
    /**
     * Typed confirmation for a roster-wide send. A mass mail cannot be recalled,
     * so the destructive-action pattern applies: the count is shown, and the
     * admin retypes it.
     */
    confirmRecipientCount: z.number().int().nonnegative().optional(),
  })
  .refine((v) => v.audience !== "SINGLE_CAPPER" || Boolean(v.userId), {
    message: "Choose which capper to message.",
    path: ["userId"],
  });

export type BroadcastInput = z.infer<typeof broadcastSchema>;
