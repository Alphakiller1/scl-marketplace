import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <span className="bg-brand/15 text-brand mb-4 flex size-11 items-center justify-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="text-brand text-xs font-semibold uppercase">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </header>
  );
}

export function AuthStatusNotice({
  tone,
  title,
  description,
}: {
  tone: "success" | "error" | "info";
  title: string;
  description: string;
}) {
  const toneClass = {
    success: "border-pos/30 bg-pos/10 text-pos",
    error: "border-neg/30 bg-neg/10 text-neg",
    info: "border-live/30 bg-live/10 text-live",
  }[tone];

  return (
    <div className={`rounded-xl border p-4 ${toneClass}`} role="status">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm opacity-90">{description}</p>
    </div>
  );
}

export function AuthFormSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading account form">
      <Skeleton className="size-11 rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}
