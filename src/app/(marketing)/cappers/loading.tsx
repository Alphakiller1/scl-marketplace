import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonCard } from "@/components/scl/states";

export default function CappersLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-3 h-10 w-full max-w-xl" />
      <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
      <Skeleton className="mt-6 h-32 w-full" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <SkeletonCard key={index} />
        ))}
      </div>
    </div>
  );
}
