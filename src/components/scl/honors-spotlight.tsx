import { Award } from "lucide-react";

import { AWARD_PERIODS, type AwardPeriod, type HonorAward } from "@/lib/honors";
import { HonorAccolade } from "@/components/scl/honor-accolade";
import { HonorScroller } from "@/components/scl/honor-scroller";

const EMPTY_COPY: Record<AwardPeriod, string> = {
  annual: "No annual award has been granted yet.",
  season: "No completed season has a qualifying winner yet.",
  monthly: "Last month's awards are granted once the month is complete.",
};

function periodSubtitle(period: AwardPeriod, awards: HonorAward[]) {
  if (!awards.length) return null;
  if (period === "season") return "Latest completed season, by sport";
  return awards[0]!.periodLabel;
}

/**
 * SCL Honors on display, one row per award period: Annual · Season · Monthly.
 * Every award is its 4:5 share graphic and opens the award page, where it can
 * be downloaded and the winner's profile is one tap away.
 */
export function HonorsSpotlight({
  featured,
}: {
  featured: Record<AwardPeriod, HonorAward[]>;
}) {
  const total =
    featured.annual.length + featured.season.length + featured.monthly.length;
  return (
    <section
      className="min-w-0 space-y-6"
      aria-labelledby="honors-spotlight-title"
      data-honor-count={total}
    >
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
      {AWARD_PERIODS.map(({ key, label }, periodIndex) => {
        const awards = featured[key];
        const subtitle = periodSubtitle(key, awards);
        const titleId = `honors-period-${key}`;
        return (
          <section
            key={key}
            className="min-w-0 space-y-3"
            aria-labelledby={titleId}
          >
            <div className="border-border flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 border-b pb-2">
              <h3 id={titleId} className="scl-display text-lg font-bold">
                {label}
              </h3>
              {subtitle ? (
                <p className="text-muted-foreground text-xs">{subtitle}</p>
              ) : null}
            </div>
            {awards.length ? (
              <HonorScroller label={`${label} honors`}>
                {awards.map((award, index) => (
                  <HonorAccolade
                    key={award.id}
                    award={award}
                    href={`/honors/${award.id}`}
                    sizes="(min-width: 640px) 240px, 216px"
                    eager={periodIndex === 0 && index < 2}
                    className="w-[13.5rem] sm:w-60"
                  />
                ))}
              </HonorScroller>
            ) : (
              <p className="border-border text-muted-foreground rounded-xl border p-4 text-sm">
                {EMPTY_COPY[key]}
              </p>
            )}
          </section>
        );
      })}
    </section>
  );
}
