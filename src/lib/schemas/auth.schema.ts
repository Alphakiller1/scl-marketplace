import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(100, "Password must be under 100 characters");

/** Shared normalization: drop a leading `@`, trim, lowercase. */
const normalizedHandle = z
  .string()
  .trim()
  .transform((value) => value.replace(/^@+/, "").toLowerCase());

/**
 * Public SCL @handle — for *creating* or *changing* a handle (signup, profile).
 * Strips a leading `@`, lowercases, then enforces length + charset.
 */
export const sclUsernameSchema = normalizedHandle.pipe(
  z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be under 20 characters")
    .regex(/^[a-z0-9_]+$/, "Letters, numbers, and underscores only"),
);

/**
 * The same handle when someone is *identifying an account they already have* —
 * signing in, resetting a password, re-requesting verification.
 *
 * Deliberately more permissive on length: the legacy importer and extractor
 * accept handles up to 30 characters (`legacy-import.schema.ts`,
 * `extract-legacy-mysql.py`), so imported cappers exist whose handle is longer
 * than today's 20-character ceiling for new signups. Judging an existing handle
 * by the rules for a new one rejected them at the form, before any lookup ran —
 * they could never sign in, whatever password they typed, and the error blamed
 * their credentials.
 *
 * Charset and the 3-character floor still apply, so this is not a way to smuggle
 * junk into a lookup.
 */
export const sclExistingUsernameSchema = normalizedHandle.pipe(
  z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be under 30 characters")
    .regex(/^[a-z0-9_]+$/, "Letters, numbers, and underscores only"),
);

/**
 * What someone types to identify themselves at sign-in: a username or an email.
 *
 * An `@` decides which — but only when it isn't the leading `@` of a handle, so
 * `@capper` is a username and `capper@example.com` is an email. Both are trimmed
 * and lowercased, matching how each is stored and matched.
 */
export type LoginIdentifierKind = "email" | "username";

export function classifyLoginIdentifier(value: string): LoginIdentifierKind {
  return value.trim().replace(/^@+/, "").includes("@") ? "email" : "username";
}

export const loginIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Enter your username or email")
  .superRefine((value, context) => {
    const schema =
      classifyLoginIdentifier(value) === "email"
        ? z.string().trim().email("Enter a valid username or email")
        : sclExistingUsernameSchema;
    const result = schema.safeParse(value);
    if (!result.success) {
      context.addIssue({
        code: "custom",
        message:
          result.error.issues[0]?.message ?? "Enter a valid username or email",
      });
    }
  })
  .transform((value) =>
    classifyLoginIdentifier(value) === "email"
      ? value.trim().toLowerCase()
      : sclExistingUsernameSchema.parse(value),
  );

export const loginSchema = z.object({
  identifier: loginIdentifierSchema,
  password: z.string().min(1, "Password is required"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    username: sclUsernameSchema,
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
  // Recovering an existing account, so the imported-handle rules apply.
  username: sclExistingUsernameSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
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
