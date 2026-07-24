import { PolicyDocumentSlug } from "@prisma/client";
import { z } from "zod";

const policyDocumentSchema = z.object({
  slug: z.nativeEnum(PolicyDocumentSlug),
  title: z.string().trim().min(2, "Title is required").max(120),
  body: z
    .string()
    .trim()
    .min(20, "Policy body is too short")
    .max(50_000, "Policy body is too long"),
});

export const publishPolicyReleaseSchema = z.object({
  version: z
    .string()
    .trim()
    .min(4, "Version label is required")
    .max(32, "Keep the version label under 32 characters"),
  summary: z
    .string()
    .trim()
    .max(300, "Keep the summary under 300 characters")
    .optional(),
  requiresReacceptance: z.boolean(),
  documents: z
    .array(policyDocumentSchema)
    .length(4, "All four policy documents are required"),
});

export type PublishPolicyReleaseInput = z.infer<
  typeof publishPolicyReleaseSchema
>;
