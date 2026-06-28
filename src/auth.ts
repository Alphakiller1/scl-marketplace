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

const DUMMY_PASSWORD_HASH =
  "$2b$12$U6O4lf.XpOqiREmsRAyVpuEfD2bwKOJz7YYiq8mxaUec1gUEF7h7y";

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

        await clearRateLimit("login-email", email);

        return {
          id: user.id,
          email: user.email,
          name: user.displayName ?? user.username,
          image: user.image,
          role: user.role,
          accountStatus: user.accountStatus,
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
});
