import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/scl/states";

/** The root layout templates titles as "%s · SCL" — don't repeat the suffix. */
export const metadata = {
  title: "Page not found",
};

/**
 * Root 404. Without this file an unmatched URL — or any `notFound()` call —
 * rendered Next's built-in page, which carries none of the app's chrome or
 * theme and dead-ends the visitor with no way back to the board.
 */
export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
      <EmptyState
        icon={Compass}
        headingLevel="h1"
        title="Page not found"
        description="That link has moved or never existed. The leaderboard is the fastest way back."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="brand" render={<Link href="/leaderboard" />}>
              View the leaderboard
            </Button>
            <Button variant="outline" render={<Link href="/" />}>
              Go home
            </Button>
          </div>
        }
      />
    </main>
  );
}
