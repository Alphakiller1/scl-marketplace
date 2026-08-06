import { cache } from "react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { emailVerificationEnforced } from "@/lib/email-verification-policy";
import { getCurrentPolicyBundle } from "@/lib/queries/policies";

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

  const currentPolicyBundle = await getCurrentPolicyBundle();
  const currentPolicyVersion = currentPolicyBundle.id;
  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      role: true,
      accountStatus: true,
      emailVerified: true,
      // Set when a sign-in succeeded with a password carried over from the
      // previous platform that no longer meets the current requirements. It
      // drives the update prompt only — it never gates access.
      passwordUpdateRequiredAt: true,
      termsAcceptances: {
        where: { policyVersion: currentPolicyVersion },
        select: { acceptedAt: true, policyVersion: true },
        orderBy: { acceptedAt: "desc" },
        take: 1,
      },
    },
  });
  if (!account) return null;

  return {
    ...user,
    // Authorize against the LIVE DB role, never the (possibly stale or
    // over-privileged) role baked into the JWT at login. A demotion takes
    // effect immediately — no re-login required — and a bad token can't grant admin.
    role: account.role,
    accountStatus: account.accountStatus,
    emailVerified: account.emailVerified,
    passwordUpdateRequiredAt: account.passwordUpdateRequiredAt,
    legalAcceptance: account.termsAcceptances[0] ?? null,
    currentPolicyVersion,
    currentPolicyBundle,
  };
});

/**
 * Require an active account — and a verified email when the gate is on.
 *
 * The unverified check is conditional because `emailVerified` is now only ever
 * written by a real verification click. Signup no longer pre-stamps it to keep
 * people out of `/verify`, so gating unconditionally here would strand every
 * account created while the gate is off.
 */
export async function requireActiveUser() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");
  if (account.accountStatus === "PENDING") redirect("/verify");
  if (emailVerificationEnforced() && !account.emailVerified) {
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

/**
 * Require an acceptance of the *current* policy bundle.
 * `legalAcceptance` is filtered to the live bundle version, so publishing a new
 * Terms/Privacy/Responsible Gaming/Refund revision re-gates everyone who signed
 * the previous one — including accounts that predate the revision.
 */
export async function requireCurrentPolicyAcceptance() {
  const account = await requireActiveUser();
  if (!account.legalAcceptance) redirect("/accept-terms");
  return account;
}

/** Require an active account with the current terms/privacy acceptance. */
export async function requireCapperAccess() {
  return requireCurrentPolicyAcceptance();
}

/** Require a signed-in user with a verified email (when the gate is on). */
export async function requireVerifiedUser() {
  const user = await requireActiveUser();
  if (emailVerificationEnforced() && !user.emailVerified) redirect("/verify");
  return user;
}

/**
 * Require an admin; bounce non-admins to their dashboard.
 * Admins accept the current policies too — a policy revision applies to every
 * signed-in account, not only the ones that happen to use capper tools.
 */
export async function requireAdmin() {
  const user = await requireCurrentPolicyAcceptance();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
