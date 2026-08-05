import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { loginSchema } from "@/lib/schemas/auth.schema";
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

/**
 * A password carried over from the previous platform just proved itself, so it
 * becomes this account's real credential: re-hashed with bcrypt, with the
 * imported hash dropped. The account keeps working either way — if the password
 * predates the current requirements it is flagged for an update and the capper
 * is told once by email, never blocked at the door.
 */
async function adoptLegacyPassword(
  user: {
    id: string;
    email: string;
    passwordUpdateRequiredAt: Date | null;
    passwordNoticeSentAt: Date | null;
  },
  password: string,
) {
  const now = new Date();
  const compliant = meetsCurrentPasswordPolicy(password);

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        legacyPasswordHash: null,
        legacyPasswordFormat: null,
        passwordUpdateRequiredAt: compliant
          ? null
          : (user.passwordUpdateRequiredAt ?? now),
      },
    });
  } catch (error) {
    // The password was correct — a failed upgrade must not cost them the login.
    // The legacy hash stays put and the next sign-in retries the migration.
    console.error("[auth] legacy password upgrade failed:", error);
    return;
  }

  if (compliant || user.passwordNoticeSentAt) return;
  if (!hasDeliverableEmail(user.email)) return;

  try {
    const delivery = await sendPasswordUpdateRequiredEmail(user.email);
    if (delivery.delivered) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordNoticeSentAt: now },
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const requestIdentity = await getRequestIdentity();
        const [emailAllowed, requestAllowed] = await Promise.all([
          isRateLimitAllowed({
            scope: "login-email",
            identity: email,
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

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            username: true,
            passwordHash: true,
            legacyPasswordHash: true,
            legacyPasswordFormat: true,
            passwordUpdateRequiredAt: true,
            passwordNoticeSentAt: true,
            image: true,
            role: true,
            accountStatus: true,
            emailVerified: true,
          },
        });
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
              identity: email,
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

        await clearRateLimit("login-email", email);

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
