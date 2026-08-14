"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { trackPackageClick } from "@/lib/meta-pixel";

/**
 * The outbound CTA for a package, isolated as a client island.
 *
 * `PackageCard` is a Server Component and an onClick handler cannot cross that
 * boundary, so the button becomes the client component rather than the whole card
 * — the shipped bundle stays this file. The marketplace register is already a
 * client component, but shares this anyway so the event fires identically from
 * both surfaces instead of being written twice and drifting.
 *
 * `prefetch={false}` is load-bearing and must stay. /go/[slug] writes a ClickEvent
 * on every GET, and Next prefetches links on hover and in-viewport by default,
 * which silently inflated SCL's own click count for every offer on the page. The
 * Meta event is bound to onClick so it is unaffected either way — but dropping the
 * flag would corrupt the internal click data.
 */
export function PackageCheckoutLink({
  packageId,
  title,
  provider,
  trackingPath,
  label,
  variant,
  className,
}: {
  packageId: string;
  title: string;
  provider?: string | null;
  trackingPath: string;
  label: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
}) {
  return (
    <Button
      render={
        <Link
          href={trackingPath}
          target="_blank"
          rel="noopener noreferrer"
          prefetch={false}
          onClick={() => trackPackageClick({ id: packageId, title, provider })}
        />
      }
      nativeButton={false}
      variant={variant}
      className={className}
    >
      {label}
      <ArrowUpRight className="size-4" aria-hidden />
    </Button>
  );
}
