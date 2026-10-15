import Link from "next/link";

import { formatRecord, formatRoi, formatUnits } from "@/lib/format";
import type { HonorAward } from "@/lib/honors";
import { HONOR_GRAPHIC_WIDTHS, HONOR_OG_VERSION } from "@/lib/og/honor-og-card";
import { OG } from "@/lib/og/tokens";
import { cn } from "@/lib/utils";

/**
 * The award's 4:5 share graphic, the one render every accolade surface shows.
 *
 * The owner signed off on this graphic as the way an award looks, so the site
 * shows the same server render people download and post rather than a second
 * drawing of it that could drift. `HONOR_OG_VERSION` busts the CDN whenever
 * the art changes.
 */
export function honorGraphicSrc(award: Pick<HonorAward, "id">): string {
  return `/api/og/honor/${encodeURIComponent(award.id)}?v=${HONOR_OG_VERSION}`;
}

/**
 * Display-sized copies for `srcSet`. The route resizes them itself; next/image
 * cannot be used here (see `displayWidth` in the route).
 */
function honorGraphicSrcSet(award: Pick<HonorAward, "id">): string {
  const src = honorGraphicSrc(award);
  return HONOR_GRAPHIC_WIDTHS.map((w) => `${src}&w=${w} ${w}w`).join(", ");
}

/** Everything the graphic says, for readers who cannot see it. */
export function honorGraphicAlt(award: HonorAward): string {
  const { winner } = award;
  const record = formatRecord(
    winner.record.w,
    winner.record.l,
    winner.record.p,
  );
  return `${award.name}, ${award.periodLabel}: @${winner.handle}. ${formatUnits(winner.units)}, ${record} record, ${formatRoi(winner.roi)} ROI.`;
}

/**
 * One award, rendered as its share graphic and linked.
 *
 * `sizes` must match the width the layout gives the card, so the browser picks
 * a sharp copy without shipping the full 1080×1350 PNG. The dark
 * fill is the graphic's own background: it shows while the image loads, in
 * either site theme, instead of a light flash.
 */
export function HonorAccolade({
  award,
  href,
  sizes,
  eager = false,
  className,
}: {
  award: HonorAward;
  href: string;
  sizes: string;
  /** Above-the-fold cards load immediately instead of lazily. */
  eager?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "group border-border hover:border-foreground/40 focus-visible:ring-ring relative block aspect-[4/5] shrink-0 snap-start overflow-hidden rounded-[var(--scl-radius-card)] border shadow-lg transition-colors focus-visible:ring-2 focus-visible:outline-none",
        className,
      )}
      style={{ backgroundColor: OG.bg }}
    >
      {/* Plain img: the route serves its own sized copies (see srcSet). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`${honorGraphicSrc(award)}&w=${HONOR_GRAPHIC_WIDTHS[1]}`}
        srcSet={honorGraphicSrcSet(award)}
        sizes={sizes}
        alt={honorGraphicAlt(award)}
        width={1080}
        height={1350}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : undefined}
        className="absolute inset-0 size-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.015]"
      />
    </Link>
  );
}
