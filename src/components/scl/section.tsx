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
          <span className="bg-surface-2 text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
            <Icon className="size-4" />
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="text-lg leading-tight font-semibold tracking-tight">
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
          className="text-brand inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium hover:underline sm:min-h-8"
        >
          {hrefLabel}
          <ArrowRight className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
