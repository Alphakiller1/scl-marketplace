import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/schemas/auth.schema";
import { findUserByEmailAndUsername } from "@/lib/user-credentials";
import {
  clearRateLimit,
  consumeRateLimit,
  isRateLimitAllowed,
} from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";
import { verifyLegacyPassword } from "@/lib/legacy-password";
import { meetsCurrentPasswordPolicy } from "@/lib/password-policy";
import { hasDeliverableEmail } from "@/lib/account-claim";
import { sendPasswordUpdateRequiredEmail } from "@/lib/email";

const DUMMY_PASSWORD_HASH =
  "$2b$12$U6O4lf.XpOqiREmsRAyVpuEfD2bwKOJz7YYiq8mxaUec1gUEF7h7y";

type SignedInUser = {
  id: string;
  email: string;
  passwordUpdateRequiredAt: Date | null;
  passwordNoticeSentAt: Date | null;
};

/**
 * A password carried over from the previous platform just proved itself, so it
 * becomes this account's real credential: re-hashed with bcrypt, with the
 * imported hash dropped.
 */
async function adoptLegacyPassword(user: SignedInUser, password: string) {
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        legacyPasswordHash: null,
        legacyPasswordFormat: null,
      },
    });
  } catch (error) {
    // The password was correct — a failed upgrade must not cost them the login.
    // The legacy hash stays put and the next sign-in retries the migration.
    console.error("[auth] legacy password upgrade failed:", error);
  }
}

/**
 * Measure the password that just worked against the current requirements.
 *
 * This runs on every successful sign-in, not only when a carried-over hash
 * matched. Old passwords reach SCL by two routes — an imported legacy hash, or
 * an operator backfill that bcrypt-hashed each capper's existing password — and
 * the second route goes through the ordinary compare path. Checking only the
 * legacy path would leave every backfilled capper with a short password
 * unflagged and unnotified.
 *
 * Never blocks the sign-in: it sets the prompt, sends one notice, and clears
 * itself once the password is compliant. No state change means no write, so a
 * routine sign-in with a good password costs nothing extra.
 */
async function reviewPasswordStrength(user: SignedInUser, password: string) {
  const compliant = meetsCurrentPasswordPolicy(password);
  const flagged = user.passwordUpdateRequiredAt !== null;

  if (compliant) {
    if (!flagged) return;
    // Self-healing: they changed to a compliant password elsewhere.
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordUpdateRequiredAt: null, passwordNoticeSentAt: null },
      });
    } catch (error) {
      console.error("[auth] clearing password prompt failed:", error);
    }
    return;
  }

  if (!flagged) {
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordUpdateRequiredAt: new Date() },
      });
    } catch (error) {
      console.error("[auth] flagging weak password failed:", error);
      return;
    }
  }

  // Tell them once, and only if there is an inbox to tell.
  if (user.passwordNoticeSentAt || !hasDeliverableEmail(user.email)) return;
  try {
    const delivery = await sendPasswordUpdateRequiredEmail(user.email);
    if (delivery.delivered) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordNoticeSentAt: new Date() },
      });
    }
  } catch (error) {
    console.error("[auth] password update notice failed:", error);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, username, password } = parsed.data;
        const loginIdentity = `${email}:${username}`;
        const requestIdentity = await getRequestIdentity();
        const [emailAllowed, requestAllowed] = await Promise.all([
          isRateLimitAllowed({
            scope: "login-email",
            identity: loginIdentity,
            limit: 10,
            windowMs: 15 * 60 * 1000,
          }),
          isRateLimitAllowed({
            scope: "login-request",
            identity: requestIdentity,
            limit: 50,
            windowMs: 15 * 60 * 1000,
          }),
        ]);
        if (!emailAllowed || !requestAllowed) return null;

        const user = await findUserByEmailAndUsername(email, username);
        // Always run one bcrypt compare, even with no account, so a missing
        // email can't be told apart from a wrong password by response time.
        const passwordMatches = await bcrypt.compare(
          password,
          user?.passwordHash ?? DUMMY_PASSWORD_HASH,
        );

        // No SCL password matched — fall back to the credential this account
        // brought over from the previous platform, so cappers sign in with the
        // email and password they already had.
        let legacyMatched = false;
        if (user && !(user.passwordHash && passwordMatches)) {
          legacyMatched = await verifyLegacyPassword(
            password,
            user.legacyPasswordHash,
            user.legacyPasswordFormat,
          );
        }

        if (
          !user ||
          !(legacyMatched || (user.passwordHash && passwordMatches))
        ) {
          await Promise.all([
            consumeRateLimit({
              scope: "login-email",
              identity: loginIdentity,
              limit: 10,
              windowMs: 15 * 60 * 1000,
            }),
            consumeRateLimit({
              scope: "login-request",
              identity: requestIdentity,
              limit: 50,
              windowMs: 15 * 60 * 1000,
            }),
          ]);
          return null;
        }
        if (
          user.accountStatus === "SUSPENDED" ||
          user.accountStatus === "DISABLED"
        ) {
          return null;
        }

        // Migrate the imported credential only after the account clears the
        // status checks, so a suspended account is never quietly upgraded.
        if (legacyMatched) await adoptLegacyPassword(user, password);
        // Then judge the password itself — however it got here.
        await reviewPasswordStrength(user, password);

        await clearRateLimit("login-email", loginIdentity);

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          image: user.image,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
});
