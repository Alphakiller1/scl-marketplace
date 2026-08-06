import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";

/**
 * Keep a signed-in visitor out of signup and login.
 *
 * "Track Your Record" and the hero CTAs point at /signup, so a capper who is
 * already signed in was asked to create the account they are signed into. The
 * guard lives at the destination rather than on each link: there are several
 * entry points and any new one would otherwise reintroduce the dead end.
 *
 * Deliberately NOT applied to the rest of (auth) — verify, reset-password and
 * accept-terms are reached BY signed-in users and must stay reachable.
 */
export async function redirectSignedInAway(to = "/dashboard") {
  const user = await getCurrentUser();
  if (user) redirect(to);
}
