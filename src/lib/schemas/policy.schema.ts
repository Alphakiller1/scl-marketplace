import { z } from "zod";

import { POLICY_SLUGS } from "@/lib/policy-metadata";

export const policyDocumentSchema = z.object({
  slug: z.enum(POLICY_SLUGS),
  title: z
    .string()
    .trim()
    .min(3, "Enter a policy title.")
    .max(120, "Keep the title under 120 characters."),
  body: z
    .string()
    .trim()
    .min(50, "Policy copy must contain at least 50 characters.")
    .max(50_000, "Policy copy must remain under 50,000 characters."),
  version: z
    .string()
    .trim()
    .min(1, "Enter a policy version.")
    .max(64, "Keep the version under 64 characters.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "Use letters, numbers, periods, underscores, or hyphens.",
    ),
});

export type PolicyDocumentInput = z.infer<typeof policyDocumentSchema>;
