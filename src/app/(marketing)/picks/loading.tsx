import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonTable } from "@/components/scl/states";

export default function PicksLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-10 w-56 max-w-full" />
      <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      <Skeleton className="mt-6 h-12 w-full" />
      <div className="mt-6">
        <SkeletonTable />
      </div>
    </div>
  );
}
