import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/scl/states";

export default function DiscoverLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-10 w-56 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-6 space-y-6">
        {Array.from({ length: 3 }).map((_, lane) => (
          <div key={lane} className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, card) => (
                <SkeletonCard key={card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
