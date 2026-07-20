import Link from "next/link";

import { LeaderboardSnapshot } from "@/components/scl/leaderboard-snapshot";
import { FeaturedProofReceipt } from "@/components/scl/featured-proof-receipt";
import type { CapperSummary } from "@/lib/mock";
import type { FeaturedGradedPlay } from "@/lib/queries/home-live";
import { cn } from "@/lib/utils";

/**
 * Hero right-rail collage — elevated snapshot with overlapping warm proof receipt.
 * Matches mockup first-viewport board anatomy (not a flat under-fold row).
 */
export function HeroBoardCollage({
  cappers,
  leaderboardFailed,
  updatedAt,
  featuredPlay,
  featuredFailed,
  className,
}: {
  cappers: CapperSummary[];
  leaderboardFailed?: boolean;
  updatedAt: Date;
  featuredPlay: FeaturedGradedPlay | null;
  featuredFailed?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate min-h-[18rem] w-full max-w-xl lg:max-w-none",
        className,
      )}
    >
      <div className="border-border relative z-0 overflow-hidden rounded-[14px] border bg-[color:var(--scl-ink-900)]/92 shadow-[var(--scl-shadow-card)] backdrop-blur-sm">
        <div
          className="scl-scanline pointer-events-none absolute inset-0 opacity-80"
          aria-hidden
        />
        <div className="relative p-3 sm:p-4">
          <LeaderboardSnapshot
            cappers={cappers}
            failed={leaderboardFailed}
            updatedAt={updatedAt}
            limit={5}
          />
        </div>
      </div>

      {/* Overlapping documentary receipt — mockup signature */}
      <div
        className={cn(
          "pointer-events-auto absolute z-10 w-[min(100%,17.5rem)]",
          "right-0 bottom-[-1.25rem] sm:right-[-0.75rem] sm:bottom-[-1.5rem]",
          "lg:right-[-1rem] lg:bottom-[-1.75rem]",
          "rotate-[1.5deg] drop-shadow-[0_18px_40px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="max-h-[15.5rem] overflow-hidden rounded-[6px]">
          <FeaturedProofReceipt
            play={featuredPlay}
            failed={featuredFailed}
            hideHeader
          />
        </div>
        {featuredPlay ? (
          <p className="sr-only">
            Featured proof for @{featuredPlay.handle}.{" "}
            <Link href={`/cappers/${featuredPlay.handle}`}>Open profile</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
