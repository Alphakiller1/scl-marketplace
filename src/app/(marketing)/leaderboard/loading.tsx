import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/scl/states";

export default function LeaderboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-64 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <div className="mt-6 grid grid-cols-2 gap-px sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-32 w-full" />
      <div className="mt-6">
        <SkeletonTable />
      </div>
    </div>
  );
}
