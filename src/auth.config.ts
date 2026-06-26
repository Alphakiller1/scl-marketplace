import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Edge-safe Auth.js config (no Prisma/bcrypt here) — imported by middleware.
 * Providers + DB callbacks are added in the Node runtime in `src/auth.ts`.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    // Route protection lives in middleware.ts; keep this minimal/edge-safe.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.emailVerified = user.emailVerified ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.emailVerified =
          (token.emailVerified as Date | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
