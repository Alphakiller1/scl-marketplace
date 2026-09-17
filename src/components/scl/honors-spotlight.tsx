import Link from "next/link";
import { Award } from "lucide-react";

import {
  AWARD_PERIODS,
  honorResultValue,
  type AwardPeriod,
  type HonorAward,
} from "@/lib/honors";
import { HonorRow } from "@/components/scl/honor-card";

const EMPTY_COPY: Record<AwardPeriod, string> = {
  annual: "No annual award has been granted yet.",
  season: "No completed season has a qualifying winner yet.",
  monthly: "Last month's awards are granted once the month is complete.",
};

function columnSubtitle(period: AwardPeriod, awards: HonorAward[]) {
  if (!awards.length) return null;
  if (period === "season") return "Latest completed season, by sport";
  return awards[0]!.periodLabel;
}

/**
 * SCL Honors, one column per award period: Annual · Season · Monthly.
 * `limit` trims each column (home hero); the full page shows every award.
 */
export function HonorsSpotlight({
  featured,
  limit,
  heading = true,
  stacked = false,
}: {
  featured: Record<AwardPeriod, HonorAward[]>;
  limit?: number;
  heading?: boolean;
  /** Narrow containers (home hero): one column under another. */
  stacked?: boolean;
}) {
  const total =
    featured.annual.length + featured.season.length + featured.monthly.length;
  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby={heading ? "honors-spotlight-title" : undefined}
      aria-label={heading ? undefined : "SCL Honors winners"}
      data-honor-count={total}
    >
      {heading ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <p className="scl-eyebrow">The winning record</p>
            <h2
              id="honors-spotlight-title"
              className="scl-display flex items-center gap-2 text-2xl font-bold"
            >
              <Award className="text-foreground size-6" aria-hidden />
              SCL Honors
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Winners of the latest completed year, season, and month.
            </p>
          </div>
          <Link
            className="scl-link min-h-10 py-2 text-sm font-semibold"
            href="/honors"
          >
            Rules & all honors
          </Link>
        </div>
      ) : null}
      <div
        className={
          stacked ? "grid min-w-0 gap-3" : "grid min-w-0 gap-3 md:grid-cols-3"
        }
      >
        {AWARD_PERIODS.map(({ key, label }) => {
          const all = featured[key];
          // A trimmed column shows the biggest results, not whichever sport
          // happens to sort first.
          const ordered =
            limit && key !== "annual"
              ? [...all].sort(
                  (a, b) =>
                    Number(b.metric === "units") -
                      Number(a.metric === "units") ||
                    honorResultValue(b) - honorResultValue(a),
                )
              : all;
          const shown = limit ? ordered.slice(0, limit) : ordered;
          const subtitle = columnSubtitle(key, all);
          return (
            <div
              key={key}
              className="border-border min-w-0 overflow-hidden rounded-xl border"
            >
              <div className="border-border bg-surface-2 border-b px-3 py-2">
                <h3 className="scl-eyebrow text-foreground">{label}</h3>
                {subtitle ? (
                  <p className="text-muted-foreground text-xs">{subtitle}</p>
                ) : null}
              </div>
              {shown.length ? (
                <ul className="divide-border divide-y">
                  {shown.map((award) => (
                    <li key={award.id}>
                      <HonorRow award={award} />
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground px-3 py-4 text-sm">
                  {EMPTY_COPY[key]}
                </p>
              )}
              {limit && all.length > shown.length ? (
                <Link
                  href="/honors"
                  className="scl-link border-border flex min-h-10 items-center border-t px-3 text-xs font-semibold"
                >
                  +{all.length - shown.length} more
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
