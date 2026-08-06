import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import {
  classifyLoginIdentifier,
  loginSchema,
} from "@/lib/schemas/auth.schema";
import {
  findLoginCandidates,
  type LoginCandidate,
} from "@/lib/user-credentials";
import { ensureAuthEmailSchema } from "@/lib/ensure-auth-email-schema";
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
import { AMBIGUOUS_LOGIN_CODE } from "@/lib/auth-errors";

type LoginUser = NonNullable<LoginCandidate>;

/** Surfaced with a code so the form can say "use your username" (see auth-errors). */
class AmbiguousLoginError extends CredentialsSignin {
  code = AMBIGUOUS_LOGIN_CODE;
}

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
        identifier: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { identifier, password } = parsed.data;
        await ensureAuthEmailSchema(prisma);
        const kind = classifyLoginIdentifier(identifier);
        const loginIdentity = `${kind}:${identifier}`;
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

        const candidates = await findLoginCandidates(identifier, kind);

        // A username names one account; an email can name several, because one
        // inbox may carry several accounts. Test the password against each and
        // let it pick — that is what makes a single identifier field workable.
        const matches: { user: LoginUser; legacy: boolean }[] = [];
        for (const candidate of candidates) {
          const sclMatch = candidate.passwordHash
            ? await bcrypt.compare(password, candidate.passwordHash)
            : false;
          if (sclMatch) {
            matches.push({ user: candidate, legacy: false });
            continue;
          }
          // No SCL password matched — fall back to the credential this account
          // brought over from the previous platform, so cappers sign in with
          // the password they already had.
          const legacyMatch = await verifyLegacyPassword(
            password,
            candidate.legacyPasswordHash,
            candidate.legacyPasswordFormat,
          );
          if (legacyMatch) matches.push({ user: candidate, legacy: true });
        }

        if (!candidates.length) {
          // Always spend one comparison, so an identifier with no account can't
          // be told from a wrong password by response time.
          await bcrypt.compare(password, DUMMY_PASSWORD_HASH);
        }

        const spendAttempt = () =>
          Promise.all([
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

        if (!matches.length) {
          await spendAttempt();
          return null;
        }

        // Several accounts on this inbox share this password, so the identifier
        // genuinely does not say which one they mean. They already proved they
        // hold the credential, so naming the ambiguity leaks nothing — and it is
        // the only way they can act on it.
        if (matches.length > 1) {
          await spendAttempt();
          throw new AmbiguousLoginError();
        }

        const { user, legacy: legacyMatched } = matches[0];
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
