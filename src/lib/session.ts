import { redirect } from "next/navigation";

import { auth } from "@/auth";

/** Current session user (or null). Server-only. */
export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

/** Require any signed-in user; redirect to login otherwise. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Require a signed-in user with a verified email. */
export async function requireVerifiedUser() {
  const user = await requireUser();
  if (!user.emailVerified) redirect("/verify");
  return user;
}

/** Require an admin; bounce non-admins to their dashboard. */
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}
