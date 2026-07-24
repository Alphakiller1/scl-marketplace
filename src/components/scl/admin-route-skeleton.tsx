import { Skeleton } from "@/components/ui/skeleton";

/** Shared skeleton for admin route transitions. */
export function AdminRouteSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-4 w-64 max-w-full" />
      <Skeleton className="h-56 w-full rounded-[var(--scl-radius-card)]" />
      <Skeleton className="h-40 w-full rounded-[var(--scl-radius-card)]" />
    </div>
  );
}
