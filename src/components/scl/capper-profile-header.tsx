import type { CapperSummary } from "@/lib/mock";
import { bookLabel, bookShort } from "@/lib/books";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import { CapperBanner } from "@/components/scl/capper-banner";
import {
  LegacyBadge,
  SportTag,
  TrophyBadge,
  VerificationBadge,
} from "@/components/scl/badges";
import { RankMovementIndicator } from "@/components/scl/indicators";
import { RankBadge, BUILDING_RECORD_LABEL } from "@/components/scl/rank-badge";
import { ProvisionalRecordHelp } from "@/components/scl/provisional-record-help";
import { Button } from "@/components/ui/button";
import { formatLastPickDate } from "@/lib/capper-activity";
import { formatJoinedDate } from "@/lib/format";
import { identityDisplayLinesFromCapper } from "@/lib/identity";
import { isProvisional } from "@/lib/sample";

/**
 * The public capper profile hero — full-bleed cover, then identity / trust
 * signals above the performance grid. Name sits below the cover so it never
 * clips under the banner (375px→1440px).
 */
export function CapperProfileHeader({ capper }: { capper: CapperSummary }) {
  // Selected coverage from CapperProfile.sports — never invent chips from play history.
  const selectedSports = capper.sports?.length ? capper.sports : [];
  const selectedBooks = capper.books?.length ? capper.books : [];
  const identity = identityDisplayLinesFromCapper(capper);
  const avatarName = identity.primary.replace(/^@/, "") || capper.handle;
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;
  const lastPickLabel = formatLastPickDate(capper.lastPlayAt);
  const activity = capper.activity;

  return (
    <article className="border-border bg-card border-b">
      {/* Full-bleed cover — breaks out of any ancestor max-width / horizontal pad. */}
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        <CapperBanner src={capper.bannerUrl} priority />
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Only the avatar overlaps the cover; actions sit beside it on larger screens. */}
        <div className="relative z-10 -mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <span className="bg-card ring-card shrink-0 rounded-xl p-1 ring-4">
            <CapperAvatar
              name={avatarName}
              src={capper.avatarUrl}
              size="xl"
              priority
            />
          </span>

          <div className="flex min-w-0 items-center gap-2 pb-1">
            <Button
              render={<a href="#recent-picks" />}
              nativeButton={false}
              className="min-h-11 sm:min-h-10"
            >
              View Picks
            </Button>
          </div>
        </div>

        {/* Identity block — always below the cover edge, never truncated by it. */}
        <div className="mt-3 min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="min-w-0 text-xl font-bold break-words sm:text-2xl lg:text-3xl">
              {identity.primary}
            </h1>
            {capper.verified ? <VerificationBadge size="md" withLabel /> : null}
            {capper.isLegacy ? <LegacyBadge /> : null}
          </div>
          {identity.secondary ? (
            <span className="text-muted-foreground mt-0.5 block text-sm break-all">
              {identity.secondary}
            </span>
          ) : null}
        </div>

        <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <RankBadge rank={capper.rank} settledPicks={capper.settledPicks} />
            <span className="leading-tight">
              <span className="text-foreground block text-xs font-semibold tracking-wide uppercase">
                {capper.rank > 0
                  ? isProvisional(capper.settledPicks)
                    ? "Provisional Rank"
                    : "Rank"
                  : "Standing"}
              </span>
              <span className="inline-flex flex-wrap items-center gap-2 text-xs">
                {capper.rank > 0 ? (
                  <>
                    #{capper.rank}
                    {capper.rankDelta && !isProvisional(capper.settledPicks) ? (
                      <RankMovementIndicator delta={capper.rankDelta} />
                    ) : null}
                  </>
                ) : (
                  <>
                    <span>{BUILDING_RECORD_LABEL}</span>
                    <ProvisionalRecordHelp label="What this means" />
                  </>
                )}
              </span>
            </span>
          </span>
          {verifiedPct != null ? (
            <>
              <span className="border-border h-7 border-l" aria-hidden />
              <span
                className="text-live text-xs font-semibold"
                title="Share of tracked picks logged pre-game and checked against the live market"
              >
                <span className="nums tabular-nums">{verifiedPct}%</span>{" "}
                Verified
              </span>
            </>
          ) : null}
          {capper.joinedAt ? (
            <>
              <span className="border-border h-7 border-l" aria-hidden />
              <span className="text-xs">
                Joined {formatJoinedDate(capper.joinedAt)}
              </span>
            </>
          ) : null}
          {lastPickLabel ? (
            <>
              <span className="border-border h-7 border-l" aria-hidden />
              <span className="text-xs">
                Last pick{" "}
                <span className="text-foreground nums font-medium tabular-nums">
                  {lastPickLabel}
                </span>
              </span>
            </>
          ) : null}
          {activity ? (
            <>
              <span className="border-border h-7 border-l" aria-hidden />
              {activity.last3Days === 0 &&
              activity.last14Days === 0 &&
              activity.month === 0 ? (
                <span
                  className="text-xs"
                  title="Tracked picks in the last 3 days, 14 days, and current calendar month: 0/3d · 0/14d · 0/mo"
                >
                  No picks this week
                </span>
              ) : (
                <span
                  className="nums text-xs tabular-nums"
                  title="Tracked picks in the last 3 days, 14 days, and current calendar month"
                >
                  <span className="text-foreground font-medium">
                    {activity.last3Days}
                  </span>
                  <span className="text-muted-foreground">/3d</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="text-foreground font-medium">
                    {activity.last14Days}
                  </span>
                  <span className="text-muted-foreground">/14d</span>
                  <span className="text-muted-foreground mx-1">·</span>
                  <span className="text-foreground font-medium">
                    {activity.month}
                  </span>
                  <span className="text-muted-foreground">/mo</span>
                </span>
              )}
            </>
          ) : null}
        </div>

        {capper.headline ? (
          <p className="mt-3 max-w-2xl text-sm font-semibold sm:text-base">
            {capper.headline}
          </p>
        ) : null}

        {selectedSports.length ||
        selectedBooks.length ||
        capper.specialties?.length ? (
          <div className="mt-3 space-y-2">
            {selectedSports.length ? (
              <div>
                <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-semibold tracking-wide uppercase">
                  Sports
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedSports.map((sport) => (
                    <SportTag key={sport} sport={sport} />
                  ))}
                </div>
              </div>
            ) : null}
            {selectedBooks.length ? (
              <div>
                <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-semibold tracking-wide uppercase">
                  Books
                </p>
                <div
                  className="flex flex-wrap items-center gap-1.5"
                  role="list"
                  aria-label="Sportsbooks"
                >
                  {selectedBooks.map((key) => (
                    <span
                      key={key}
                      role="listitem"
                      title={bookLabel(key)}
                      className="scl-data border-border text-muted-foreground inline-flex h-9 items-center justify-center rounded-[18px] border bg-[color:var(--scl-ink-800)] px-3 text-[11px] font-medium tracking-[0.08em] uppercase"
                    >
                      {bookShort(key)}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {capper.specialties?.length ? (
              <div>
                <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-semibold tracking-wide uppercase">
                  Specialties
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {capper.specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="border-border bg-surface-2 text-muted-foreground rounded-lg border px-2 py-1 text-xs font-medium"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {capper.bio ? (
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">
            {capper.bio}
          </p>
        ) : null}

        {capper.trophies.length ? (
          <div className="mt-3 flex flex-wrap gap-2 pb-5 sm:pb-6">
            {capper.trophies.map((trophy) => (
              <TrophyBadge key={trophy} label={trophy} />
            ))}
          </div>
        ) : (
          <div className="pb-5 sm:pb-6" />
        )}
      </div>
    </article>
  );
}
