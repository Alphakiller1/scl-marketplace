"use client";

import { useEffect, useState } from "react";
import type { Role } from "@prisma/client";

export type SessionUser = { role?: Role | null };

/**
 * Read the signed-in user in the browser.
 *
 * Public pages must not touch `auth()` / `cookies()` during the server render.
 * Without Partial Prerendering, a single dynamic API anywhere in the tree opts
 * the whole route into dynamic rendering — even inside `<Suspense>` — which is
 * what was defeating `export const revalidate = 60` on every marketing page and
 * making each visit pay a full server render plus database round-trips.
 *
 * Returns `null` until the session resolves, and on failure. Anonymous is both
 * the common case and the correct fallback for public chrome, so callers render
 * their signed-out state first and swap if a session turns up.
 */
export function useSessionUser(): SessionUser | null {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: SessionUser } | null) => {
        if (active) setUser(data?.user ?? null);
      })
      .catch(() => {
        // Public chrome has a correct signed-out state; a failed lookup is not
        // an error worth surfacing.
      });
    return () => {
      active = false;
    };
  }, []);

  return user;
}
