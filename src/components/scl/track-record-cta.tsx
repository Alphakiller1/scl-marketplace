"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TRACK_YOUR_RECORD_CTA } from "@/lib/cold-start-copy";
import { useSessionUser } from "@/lib/use-session-user";

const BUTTON_CLASS = "min-h-10 w-full shrink-0 gap-2 sm:w-auto";

/**
 * Signed-out fallback, rendered while the session resolves.
 *
 * Anonymous is both the common case and the cached one, so showing it first
 * keeps the band useful instantly and avoids a flash of the wrong destination.
 */
export function TrackRecordCtaFallback() {
  return (
    <Button
      render={<Link href="/signup" />}
      nativeButton={false}
      variant="brand"
      size="lg"
      className={BUTTON_CLASS}
    >
      {TRACK_YOUR_RECORD_CTA} <ArrowRight className="size-4" aria-hidden />
    </Button>
  );
}

/**
 * "Track Your Record" pointed at /signup unconditionally, so a signed-in capper
 * was sent to create an account they already have. The destination now follows
 * the session: a capper goes where the record is actually kept.
 *
 * The session is read in the browser, not during the server render. This was
 * previously an async server component reading `getCurrentUser()`, on the
 * assumption that a Suspense island kept the page static. It does not — without
 * Partial Prerendering one dynamic API opts the whole route into dynamic
 * rendering, so this single call was making the home page re-render and
 * re-query the database on every request.
 */
export function TrackRecordCta() {
  const user = useSessionUser();
  if (!user) return <TrackRecordCtaFallback />;

  return (
    <Button
      render={<Link href="/dashboard/picks/new" />}
      nativeButton={false}
      variant="brand"
      size="lg"
      className={BUTTON_CLASS}
    >
      Log A Pick <ArrowRight className="size-4" aria-hidden />
    </Button>
  );
}
