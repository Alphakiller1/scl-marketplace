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
 * Longest public @handle SCL accepts.
 *
 * 30 rather than 20 because that is what the rest of the system already used:
 * the legacy importer and extractor accept 30, so imported cappers have always
 * existed above the old signup ceiling. Keeping new signups at 20 meant SCL
 * would refuse to create a handle it was perfectly willing to host.
 */
export const SCL_USERNAME_MAX_LENGTH = 30;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_TOO_SHORT = `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
const USERNAME_TOO_LONG = `Username must be ${SCL_USERNAME_MAX_LENGTH} characters or fewer`;
const USERNAME_CHARSET = "Letters, numbers, and underscores only";

/**
 * Public SCL @handle — for *creating* or *changing* a handle (signup, profile).
 * Strips a leading `@`, lowercases, then enforces length + charset.
 */
export const sclUsernameSchema = normalizedHandle.pipe(
  z
    .string()
    .min(USERNAME_MIN_LENGTH, USERNAME_TOO_SHORT)
    .max(SCL_USERNAME_MAX_LENGTH, USERNAME_TOO_LONG)
    .regex(/^[a-z0-9_]+$/, USERNAME_CHARSET),
);

/**
 * The same handle when someone is *identifying an account they already have* —
 * signing in, resetting a password, re-requesting verification.
 *
 * This used to be the more permissive of the two, because signup capped handles
 * at 20 while imported cappers ran to 30: judging an existing handle by the
 * rules for a new one rejected them at the form before any lookup ran, so they
 * could never sign in whatever password they typed, and the error blamed their
 * credentials. Both now share one ceiling and the split no longer does any
 * work — kept as a separate export because sign-in and signup are different
 * operations, and a future rule that tightens one should not silently lock out
 * accounts created under the other.
 */
export const sclExistingUsernameSchema = sclUsernameSchema;

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

/**
 * Recovery takes the same single identifier as sign-in.
 *
 * It used to demand email *and* username together. Someone who signs in with
 * just their handle does not necessarily know which address the account carries
 * — imported accounts sit on shared brand inboxes and plus-addressed variants —
 * and because this endpoint must not enumerate accounts, a mismatched pair
 * returns success and sends nothing. The reset mail that "never arrives" was
 * usually this: a wrong guess at the other half of the pair.
 */
export const passwordResetRequestSchema = z.object({
  identifier: loginIdentifierSchema,
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
