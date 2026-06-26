import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export function SectionHeader({
  title,
  subtitle,
  href,
  hrefLabel = "View all",
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
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="bg-surface-2 text-brand flex size-8 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {href ? (
        <Link
          href={href}
          className="text-brand inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
