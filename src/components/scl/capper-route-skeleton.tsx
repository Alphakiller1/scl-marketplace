import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeleton for capper dashboard route transitions. */
export function CapperRouteSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 rounded-[var(--scl-radius-card)]" />
        <Skeleton className="h-24 rounded-[var(--scl-radius-card)]" />
        <Skeleton className="h-24 rounded-[var(--scl-radius-card)]" />
      </div>
      <Skeleton className="h-48 w-full rounded-[var(--scl-radius-card)]" />
      <Skeleton className="h-32 w-full rounded-[var(--scl-radius-card)]" />
    </div>
  );
}
