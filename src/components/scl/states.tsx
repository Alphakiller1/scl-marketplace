import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Thoughtful empty state — required for every async surface. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border-border bg-card flex flex-col items-center justify-center rounded-[var(--scl-radius-card)] border px-4 py-9 text-center sm:px-6 sm:py-12",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-3 flex size-12 items-center justify-center rounded-xl border border-[color:var(--scl-line)] bg-[color:var(--scl-ink-700)] text-[color:var(--scl-blue)]">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <h3 className="scl-display text-base font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4 w-full sm:w-auto">{action}</div> : null}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("border-border bg-card rounded-xl border p-4", className)}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="border-border flex items-center gap-3 rounded-xl border px-3 py-2.5"
        >
          <Skeleton className="size-5 rounded" />
          <Skeleton className="size-8 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}
