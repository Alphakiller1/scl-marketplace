import Link from "next/link";

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
  const lastPickLabel = formatLastPickDate(capper.lastPlayAt);
  const sports = capper.sports?.length
    ? capper.sports
    : capper.topSport
      ? [capper.topSport]
      : [];
  const specialties = (capper.specialties ?? [])
    .filter(
      (specialty) =>
        specialty.trim().length > 0 &&
        !sports.some(
          (sport) => sport.toLowerCase() === specialty.trim().toLowerCase(),
        ),
    )
    .slice(0, 2);
  const hasCoverage = sports.length > 0 || specialties.length > 0;

  return (
    <header className="border-border relative overflow-hidden border-b bg-[linear-gradient(165deg,color-mix(in_srgb,var(--scl-ink-800)_70%,var(--scl-ink-900))_0%,var(--scl-ink-900)_100%)]">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--scl-blue)_40%,transparent)_35%,color-mix(in_srgb,var(--scl-pink)_28%,transparent)_70%,transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-[1400px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="ring-border shrink-0 rounded-2xl bg-[color:var(--scl-ink-800)] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1">
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
                {capper.isLegacy ? (
                  <LegacyBadge carriedResults={capper.legacyCarriedResults} />
                ) : null}
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

              {/*
                An imported profile nobody has taken ownership of yet. Claiming
                runs through the ordinary password-reset flow — it sets a
                password and verifies the address in one step — but a capper who
                never signed up would never think to click "Forgot password",
                so the route is surfaced here instead. Setting emailVerified is
                what makes this disappear, so it self-retires on claim.
              */}
              {capper.isLegacy && !capper.verified ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  Is this you?{" "}
                  <Link
                    href="/forgot-password"
                    className="scl-link font-medium underline underline-offset-2"
                  >
                    Claim this profile
                  </Link>{" "}
                  to log in and keep posting.
                </p>
              ) : null}

              {hasCoverage ? (
                <div
                  data-profile-specialties
                  className="mt-2 flex flex-wrap items-center gap-1.5"
                  aria-label="Sports and specialties"
                >
                  {sports.map((sport) => (
                    <SportTag key={sport} sport={sport} forceLabel />
                  ))}
                  {specialties.map((specialty) => (
                    <span
                      key={specialty}
                      className="border-border bg-surface-2 text-muted-foreground inline-flex rounded-full border px-1.5 py-1 text-[0.65rem] leading-none font-semibold tracking-wide"
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
                    <span>{BUILDING_RECORD_LABEL}</span>
                  )}
                </span>
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

            <ProfileActionGroup className="mt-3 shrink-0 lg:mt-0 lg:justify-end" />
          </div>
        </div>
      </div>
    </header>
  );
}
