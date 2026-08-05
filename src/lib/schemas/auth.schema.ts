import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(100, "Password must be under 100 characters");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must be at least 3 characters")
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/, "Letters, numbers, and underscores only"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: passwordSchema,
    confirmPassword: z.string(),
    confirmEligibility: z.boolean().refine((value) => value === true, {
      message: "Confirm that you meet the age and eligibility requirements",
    }),
    acceptPolicies: z.boolean().refine((value) => value === true, {
      message: "Accept and acknowledge the required policies to continue",
    }),
    acknowledgeResponsibleGaming: z
      .boolean()
      .refine((value) => value === true, {
        message: "Acknowledge the Responsible Gaming Policy to continue",
      }),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
});
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;

export const verificationRequestSchema = passwordResetRequestSchema;
export type VerificationRequestInput = PasswordResetRequestInput;

/**
 * In-app password change. `currentPassword` has no policy floor of its own — a
 * capper who signed in with a password carried over from the previous platform
 * is exactly who this form is for, and theirs predates the current rules.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.password !== data.currentPassword, {
    message: "Choose a password you haven't used here before",
    path: ["password"],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .regex(/^[a-f0-9]{64}$/, "This reset link is invalid or expired"),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
