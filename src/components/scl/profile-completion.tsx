import { Check, Circle } from "lucide-react";

import type { ProfileCompletion } from "@/lib/profile-completion";
import { cn } from "@/lib/utils";

export function ProfileCompletionPanel({
  completion,
}: {
  completion: ProfileCompletion;
}) {
  return (
    <section
      aria-labelledby="profile-completion-title"
      className="border-border bg-card rounded-xl border p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="profile-completion-title" className="font-semibold">
            Profile Strength
          </h2>
          <p className="text-muted-foreground text-sm">
            {completion.completed} of {completion.total} identity signals
          </p>
        </div>
        <span className="nums text-brand text-xl font-bold tabular-nums">
          {completion.percentage}%
        </span>
      </div>

      <div
        className="bg-surface-2 mt-3 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label="Profile completion"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={completion.percentage}
      >
        <div
          className="bg-brand h-full rounded-full transition-[width] motion-reduce:transition-none"
          style={{ width: `${completion.percentage}%` }}
        />
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {completion.items.map((item) => (
          <li
            key={item.id}
            className={cn(
              "flex items-center gap-2 text-sm",
              item.complete ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {item.complete ? (
              <Check className="text-pos size-4" aria-hidden />
            ) : (
              <Circle className="size-4" aria-hidden />
            )}
            {item.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
