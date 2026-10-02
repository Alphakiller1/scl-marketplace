"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  AudienceFilterControls,
  audienceSelectClassName,
} from "@/components/scl/audience-filter-controls";
import { audienceListHref } from "@/lib/admin-audience";
import {
  emptyAudienceFilters,
  type AudienceFilters,
} from "@/lib/schemas/audience.schema";

/**
 * Filter bar for /admin/audiences. The filters live in the URL, so every group
 * is a shareable link and the server renders the matching list.
 */
export function AudienceExplorer({
  filters,
  savedGroups,
}: {
  filters: AudienceFilters;
  savedGroups: { id: string; name: string; filters: AudienceFilters }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(next: AudienceFilters) {
    startTransition(() => {
      router.replace(audienceListHref(next), { scroll: false });
    });
  }

  return (
    <div className="space-y-3" aria-busy={pending}>
      <AudienceFilterControls
        filters={filters}
        onChange={(patch) => go({ ...filters, ...patch })}
      />
      <div className="flex flex-wrap items-end gap-3">
        {savedGroups.length ? (
          <label className="min-w-56 flex-1 space-y-1 sm:flex-none">
            <span className="text-muted-foreground text-xs font-semibold uppercase">
              Saved groups
            </span>
            <select
              value=""
              onChange={(event) => {
                const group = savedGroups.find(
                  (item) => item.id === event.target.value,
                );
                if (group) go(group.filters);
              }}
              className={audienceSelectClassName}
            >
              <option value="">Load a saved group…</option>
              {savedGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          onClick={() => go(emptyAudienceFilters())}
          className="text-muted-foreground hover:text-foreground min-h-10 text-sm underline underline-offset-2"
        >
          Clear filters
        </button>
        <span role="status" className="text-muted-foreground text-xs">
          {pending ? "Updating…" : ""}
        </span>
      </div>
    </div>
  );
}
