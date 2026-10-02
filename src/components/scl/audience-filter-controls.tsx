"use client";

import { useId } from "react";

import type { AudienceFilters } from "@/lib/schemas/audience.schema";

export const audienceSelectClassName =
  "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 min-h-10 w-full rounded-lg border px-3 text-sm outline-none focus-visible:ring-3";

/**
 * The shared filter set. The audience list and the campaign composer render
 * this same control, so a group built in one is the group used in the other.
 */
export function AudienceFilterControls({
  filters,
  onChange,
  disabled,
}: {
  filters: AudienceFilters;
  onChange: (patch: Partial<AudienceFilters>) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <FilterSelect
        label="Recently joined"
        value={filters.joinedWithinDays?.toString() ?? ""}
        disabled={disabled}
        onChange={(value) =>
          onChange({
            joinedWithinDays: value ? (Number(value) as 7 | 14 | 30) : null,
          })
        }
        options={[
          ["", "Any time"],
          ["7", "Last 7 days"],
          ["14", "Last 14 days"],
          ["30", "Last 30 days"],
        ]}
      />
      <FilterSelect
        label="Account"
        value={filters.accountActivity}
        disabled={disabled}
        onChange={(value) =>
          onChange({
            accountActivity: value as AudienceFilters["accountActivity"],
          })
        }
        options={[
          ["ANY", "Any status"],
          ["ACTIVE", "Active"],
          ["INACTIVE", "Inactive (pending, suspended, disabled)"],
        ]}
      />
      <FilterSelect
        label="Played recently"
        value={filters.playedWithinDays?.toString() ?? ""}
        disabled={disabled}
        onChange={(value) =>
          onChange({
            playedWithinDays: value ? (Number(value) as 3 | 7 | 14 | 30) : null,
          })
        }
        options={[
          ["", "Any activity"],
          ["3", "Played in last 3 days"],
          ["7", "Played in last 7 days"],
          ["14", "Played in last 14 days"],
          ["30", "Played in last 30 days"],
        ]}
      />
      <FilterSelect
        label="No plays"
        value={filters.noPlaysWithinDays?.toString() ?? ""}
        disabled={disabled}
        onChange={(value) =>
          onChange({
            noPlaysWithinDays: value
              ? (Number(value) as 3 | 7 | 14 | 30)
              : null,
          })
        }
        options={[
          ["", "Any activity"],
          ["3", "None in last 3 days"],
          ["7", "None in last 7 days"],
          ["14", "None in last 14 days"],
          ["30", "None in last 30 days"],
        ]}
        hint="Includes cappers who have never submitted."
      />
      <FilterSelect
        label="Verification"
        value={filters.verification}
        disabled={disabled}
        onChange={(value) =>
          onChange({ verification: value as AudienceFilters["verification"] })
        }
        options={[
          ["ANY", "Any verification"],
          ["VERIFIED", "Verified"],
          ["UNVERIFIED", "Unverified"],
        ]}
      />
      <FilterSelect
        label="Play history"
        value={filters.playHistory}
        disabled={disabled}
        onChange={(value) =>
          onChange({ playHistory: value as AudienceFilters["playHistory"] })
        }
        options={[
          ["ANY", "Any history"],
          ["HAS_PLAYS", "Has submitted plays"],
          ["NEVER_SUBMITTED", "Never submitted"],
        ]}
      />
      <FilterSelect
        label="Storefront"
        value={filters.storefront}
        disabled={disabled}
        onChange={(value) =>
          onChange({ storefront: value as AudienceFilters["storefront"] })
        }
        options={[
          ["ANY", "Any storefront"],
          ["CONNECTED", "Connected"],
          ["NOT_CONNECTED", "Not connected"],
          ["AWAITING_REVIEW", "Awaiting SCL review"],
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground text-xs font-semibold uppercase">
        {label}
      </span>
      <select
        value={value}
        disabled={disabled}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={audienceSelectClassName}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || "any"} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {hint ? (
        <span id={hintId} className="text-muted-foreground block text-[0.7rem]">
          {hint}
        </span>
      ) : null}
    </label>
  );
}
