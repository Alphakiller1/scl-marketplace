import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { consumeAdminLoginChallenge } from "@/lib/admin-login-challenge";
import { toSessionUser, verifyLoginCredentials } from "@/lib/credentials";
import { adminLoginCodeSchema, loginSchema } from "@/lib/schemas/auth.schema";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        challengeId: { label: "Challenge", type: "text" },
        code: { label: "Sign-in code", type: "text" },
      },
      async authorize(credentials) {
        // Step two of admin sign-in: the challenge only exists because the
        // password was already verified, so the code alone completes it.
        const challenge = adminLoginCodeSchema.safeParse(credentials);
        if (challenge.success) {
          const userId = await consumeAdminLoginChallenge(
            challenge.data.challengeId,
            challenge.data.code,
          );
          if (!userId) return null;

          const user = await prisma.user.findUnique({ where: { id: userId } });
          if (!user || user.email.toLowerCase() !== challenge.data.email) {
            return null;
          }
          if (
            user.accountStatus === "SUSPENDED" ||
            user.accountStatus === "DISABLED"
          ) {
            return null;
          }
          return toSessionUser(user);
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await verifyLoginCredentials(
          parsed.data.email,
          parsed.data.password,
        );
        if (!user) return null;

        // Admins must finish the emailed-code step. Without this, posting
        // straight to /api/auth/callback/credentials would skip the second
        // factor entirely.
        if (user.role === "ADMIN") return null;

        return toSessionUser(user);
      },
    }),
  ],
});
