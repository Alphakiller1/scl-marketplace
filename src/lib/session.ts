import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CURRENT_POLICY_VERSION } from "@/lib/legal";

/**
 * Current session user (or null). Server-only.
 * Request-scoped cache — layout + page share one Auth.js lookup.
 */
export const getCurrentUser = cache(async () => {
  const session = await auth();
  return session?.user ?? null;
});

/** Require any signed-in user; redirect to login otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Current session plus fresh account state for authorization decisions.
 * Request-scoped cache — avoids duplicate Prisma hits when layout and page
 * both call requireCapperAccess / requireActiveUser.
 */
export const getCurrentAccount = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      accountStatus: true,
      emailVerified: true,
      termsAcceptances: {
        where: { policyVersion: CURRENT_POLICY_VERSION },
        select: { acceptedAt: true, policyVersion: true },
        orderBy: { acceptedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!account) return null;

  return {
    ...user,
    accountStatus: account.accountStatus,
    emailVerified: account.emailVerified,
    legalAcceptance: account.termsAcceptances[0] ?? null,
  };
});

/** Require a verified, active account. */
export async function requireActiveUser() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.accountStatus === "PENDING" || !account.emailVerified) {
    redirect("/verify");
  }
  if (
    account.accountStatus === "SUSPENDED" ||
    account.accountStatus === "DISABLED"
  ) {
    redirect("/account-restricted");
  }
  return account;
}

/** Require an active account with the current terms/privacy acceptance. */
export async function requireCapperAccess() {
  const account = await requireActiveUser();
  if (!account.legalAcceptance) redirect("/accept-terms");
  return account;
}

/** Require a signed-in user with a verified email. */
export async function requireVerifiedUser() {
  const user = await requireActiveUser();
  if (!user.emailVerified) redirect("/verify");
  return user;
}

/** Require an admin; bounce non-admins to their dashboard. */
export async function requireAdmin() {
  const user = await requireActiveUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
