import { passwordSchema } from "@/lib/schemas/auth.schema";

/**
 * The current password requirements, stated once so login, the reset form, and
 * the "your password is too weak" notice can't drift apart.
 *
 * A password carried over from the previous platform predates these rules, so a
 * failing check never blocks a sign-in — it flags the account and prompts an
 * update (see `src/auth.ts` and the dashboard password card).
 */
export const PASSWORD_POLICY_SUMMARY = "at least 12 characters";

export function meetsCurrentPasswordPolicy(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}
