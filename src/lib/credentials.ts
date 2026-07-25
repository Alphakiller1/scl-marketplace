import "server-only";

import type { User } from "@prisma/client";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import {
  clearRateLimit,
  consumeRateLimit,
  isRateLimitAllowed,
} from "@/lib/rate-limit";
import { getRequestIdentity } from "@/lib/request-identity";

// Compared against when no account matches, so a missing user costs the same
// time as a wrong password and the form can't be used to enumerate accounts.
const DUMMY_PASSWORD_HASH =
  "$2b$12$U6O4lf.XpOqiREmsRAyVpuEfD2bwKOJz7YYiq8mxaUec1gUEF7h7y";

const EMAIL_WINDOW = { limit: 10, windowMs: 15 * 60 * 1000 };
const REQUEST_WINDOW = { limit: 50, windowMs: 15 * 60 * 1000 };

/**
 * Verify an email/password pair under the shared login throttle.
 *
 * Both the credentials provider and the admin code-request action call this, so
 * they burn the same counters — checking the password through one entry point
 * can never buy extra attempts at the other.
 */
export async function verifyLoginCredentials(
  email: string,
  password: string,
): Promise<User | null> {
  const requestIdentity = await getRequestIdentity();
  const [emailAllowed, requestAllowed] = await Promise.all([
    isRateLimitAllowed({
      scope: "login-email",
      identity: email,
      ...EMAIL_WINDOW,
    }),
    isRateLimitAllowed({
      scope: "login-request",
      identity: requestIdentity,
      ...REQUEST_WINDOW,
    }),
  ]);
  if (!emailAllowed || !requestAllowed) return null;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  const passwordMatches = await bcrypt.compare(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  if (!user?.passwordHash || !passwordMatches) {
    await Promise.all([
      consumeRateLimit({
        scope: "login-email",
        identity: email,
        ...EMAIL_WINDOW,
      }),
      consumeRateLimit({
        scope: "login-request",
        identity: requestIdentity,
        ...REQUEST_WINDOW,
      }),
    ]);
    return null;
  }

  if (user.accountStatus === "SUSPENDED" || user.accountStatus === "DISABLED") {
    return null;
  }

  await clearRateLimit("login-email", email);
  return user;
}

/** Shape the credentials provider hands back to Auth.js. */
export function toSessionUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.username,
    image: user.image,
    role: user.role,
    accountStatus: user.accountStatus,
    emailVerified: user.emailVerified,
  };
}
