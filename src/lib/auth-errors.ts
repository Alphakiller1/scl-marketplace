/**
 * Sign-in error codes shared by the server (`src/auth.ts`) and the sign-in form.
 *
 * Kept dependency-free so the client bundle can import the code without pulling
 * in Prisma or bcrypt through the auth module.
 */

/**
 * The identifier matched more than one account and the password fits all of
 * them, so SCL cannot tell which profile was meant. Distinct from a failed
 * sign-in: the credential was correct, and "wrong credentials" would send the
 * capper off to reset a password that already works.
 */
export const AMBIGUOUS_LOGIN_CODE = "ambiguous_account";

export const AMBIGUOUS_LOGIN_MESSAGE =
  "Several accounts use that email. Sign in with the username of the profile you want.";
