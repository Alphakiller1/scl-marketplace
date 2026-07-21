import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  LegacyBadge,
  SportTag,
  VerificationBadge,
} from "@/components/scl/badges";
import { RankMovementIndicator } from "@/components/scl/indicators";
import { RankBadge, BUILDING_RECORD_LABEL } from "@/components/scl/rank-badge";
import { ProfileActionGroup } from "@/components/scl/profile-action-group";
import { ProvisionalRecordHelp } from "@/components/scl/provisional-record-help";
import { formatLastPickDate } from "@/lib/capper-activity";
import { identityDisplayLinesFromCapper } from "@/lib/identity";
import { isProvisional } from "@/lib/sample";

/**
 * Proof-mode public profile identity — compact strip (≤ ~200px).
 * No cover band. Bio / sports / books / social live in CapperProfileMeta
 * below evidence + proof history.
 */
export function CapperProfileHeader({ capper }: { capper: CapperSummary }) {
  const identity = identityDisplayLinesFromCapper(capper);
  const avatarName = identity.primary.replace(/^@/, "") || capper.handle;
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;
  const lastPickLabel = formatLastPickDate(capper.lastPlayAt);
  const specialties = (capper.specialties ?? [])
    .filter(
      (specialty) =>
        specialty.trim().length > 0 &&
        specialty.trim().toLowerCase() !==
          (capper.topSport ?? "").toLowerCase(),
    )
    .slice(0, 2);
  const hasCoverage = Boolean(capper.topSport || specialties.length);

  return (
    <header className="border-border bg-card border-b">
      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="bg-card ring-border shrink-0 rounded-2xl p-0.5 ring-1">
            <CapperAvatar
              name={avatarName}
              src={capper.avatarUrl}
              size="xxl"
              className="size-20 sm:size-28"
              priority
            />
          </span>

          <div className="min-w-0 flex-1 lg:flex lg:items-center lg:justify-between lg:gap-8">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="scl-display min-w-0 text-3xl font-bold tracking-[0.02em] break-words sm:text-4xl">
                  {identity.primary}
                </h1>
                {capper.verified ? (
                  <VerificationBadge size="sm" withLabel />
                ) : null}
                {capper.isLegacy ? <LegacyBadge /> : null}
              </div>
              {identity.secondary ? (
                <span className="text-muted-foreground mt-0.5 block text-sm break-all">
                  {identity.secondary}
                </span>
              ) : null}

              {capper.headline ? (
                <p className="text-muted-foreground mt-1 max-w-2xl text-sm leading-snug sm:text-base">
                  {capper.headline}
                </p>
              ) : null}

              {hasCoverage ? (
                <div
                  data-profile-specialties
                  className="mt-2 flex flex-wrap items-center gap-1.5"
                  aria-label="Sports and specialties"
                >
                  {capper.topSport ? (
                    <SportTag sport={capper.topSport} withMark={false} />
                  ) : null}
                  {specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="border-border bg-surface-2 text-muted-foreground inline-flex rounded-md border px-2 py-0.5 text-[0.7rem] font-semibold tracking-wide"
                    >
                      {specialty}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5">
                  <RankBadge
                    rank={capper.rank}
                    settledPicks={capper.settledPicks}
                    className="size-7 text-[0.7rem]"
                  />
                  {capper.rank > 0 ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="text-foreground font-semibold tabular-nums">
                        #{capper.rank}
                      </span>
                      {isProvisional(capper.settledPicks) ? (
                        <span className="font-semibold tracking-wide uppercase">
                          Provisional
                        </span>
                      ) : capper.rankDelta ? (
                        <RankMovementIndicator delta={capper.rankDelta} />
                      ) : null}
                    </span>
                  ) : (
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <span>{BUILDING_RECORD_LABEL}</span>
                      <ProvisionalRecordHelp label="What This Means" />
                    </span>
                  )}
                </span>
                {verifiedPct != null ? (
                  <>
                    <span className="border-border h-4 border-l" aria-hidden />
                    <span title="Share of tracked picks logged pre-game and checked against the live market">
                      <span className="text-foreground font-semibold tabular-nums">
                        {verifiedPct}%
                      </span>{" "}
                      verified
                    </span>
                  </>
                ) : null}
                {lastPickLabel ? (
                  <>
                    <span className="border-border h-4 border-l" aria-hidden />
                    <span>
                      Last pick{" "}
                      <span className="text-foreground font-medium tabular-nums">
                        {lastPickLabel}
                      </span>
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <ProfileActionGroup
              handle={capper.handle}
              className="mt-3 shrink-0 lg:mt-0 lg:justify-end"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
