import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  href,
  hrefLabel = "View All",
  icon: Icon,
  className,
}: {
  title: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[color:var(--scl-ink-700)] text-[color:var(--scl-muted-data)]">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0 border-t border-[color:var(--scl-pink-deep)] pt-2.5">
          <h2 className="scl-display text-lg leading-tight font-semibold tracking-[0.06em] uppercase">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-[color:var(--scl-muted-data)] hover:text-[color:var(--scl-text)] hover:underline"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
