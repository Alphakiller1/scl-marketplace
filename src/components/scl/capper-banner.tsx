import Image from "next/image";

import { cn } from "@/lib/utils";

type CapperBannerProps = {
  src?: string | null;
  /** Set on the public profile hero for LCP. */
  priority?: boolean;
  className?: string;
  heightClass?: string;
};

export function CapperBanner({
  src,
  priority = false,
  className,
  heightClass = "h-28 w-full sm:h-36 lg:h-40",
}: CapperBannerProps) {
  return (
    <div
      className={cn(
        "bg-surface-2 relative overflow-hidden",
        heightClass,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          fill
          sizes="100vw"
          priority={priority}
          className="object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 size-full bg-[color:var(--scl-ink-900)]"
        />
      )}
    </div>
  );
}
