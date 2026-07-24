import { z } from "zod";

import { passwordSchema } from "@/lib/schemas/auth.schema";

export const customerSignupSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    displayName: z
      .string()
      .trim()
      .max(60, "Keep the name under 60 characters")
      .optional()
      .transform((value) => (value && value.length >= 2 ? value : undefined)),
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.boolean().refine((value) => value === true, {
      message: "You must accept the terms to continue",
    }),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type CustomerSignupInput = z.infer<typeof customerSignupSchema>;
