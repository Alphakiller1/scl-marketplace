"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/scl/states";

/**
 * Route-level fallback for an unhandled render error.
 *
 * The app shipped without any error boundary, so a single throw in a Server
 * Component fell through to Next's built-in error page: unstyled, off-theme,
 * and with an empty <title>. A DB blip on one probe was enough to produce it.
 *
 * The digest is surfaced deliberately — it is the only handle that ties what a
 * capper saw to the server log line, and support cannot ask for what the page
 * never showed.
 */
export default function RouteError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={TriangleAlert}
        headingLevel="h1"
        title="Something went wrong"
        description="This surface failed to load. Your account and your logged plays are unaffected."
        action={
          <div className="flex flex-col items-center gap-3">
            <Button
              variant="brand"
              onClick={() => unstable_retry()}
              className="w-full sm:w-auto"
            >
              Try again
            </Button>
            {error.digest ? (
              <p className="scl-data text-muted-foreground text-xs">
                Reference {error.digest}
              </p>
            ) : null}
          </div>
        }
      />
    </main>
  );
}
