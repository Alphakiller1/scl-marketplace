import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TRACK_YOUR_RECORD_CTA } from "@/lib/cold-start-copy";
import { getCurrentUser } from "@/lib/session";

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
 * Its own island so the marketing page is not forced dynamic just to read auth —
 * the same reason the header resolves its session separately.
 */
export async function TrackRecordCta() {
  const user = await getCurrentUser();
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
