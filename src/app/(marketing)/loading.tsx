import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared marketing suspense fallback — keeps clicks from feeling stuck while
 * the route RSC resolves. Route folders may override with richer skeletons.
 */
export default function MarketingLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-10 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-8 h-48 w-full rounded-[var(--scl-radius-card)]" />
      <Skeleton className="mt-4 h-32 w-full rounded-[var(--scl-radius-card)]" />
    </div>
  );
}
