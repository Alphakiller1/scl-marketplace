import { Globe } from "lucide-react";

import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  LegacyBadge,
  SportTag,
  TrophyBadge,
  VerificationBadge,
} from "@/components/scl/badges";
import { RankMovementIndicator } from "@/components/scl/indicators";
import { RankBadge, BUILDING_RECORD_LABEL } from "@/components/scl/rank-badge";
import { Button } from "@/components/ui/button";
import { identityDisplayLinesFromCapper } from "@/lib/identity";
import { socialProfileUrl } from "@/lib/urls";

/**
 * The public capper profile hero — full-bleed cover, then identity / trust
 * signals above the performance grid. Name sits below the cover so it never
 * clips under the banner (375px→1440px).
 */
export function CapperProfileHeader({ capper }: { capper: CapperSummary }) {
  const sports = capper.sports?.length ? capper.sports : [capper.topSport];
  const identity = identityDisplayLinesFromCapper(capper);
  const avatarName = identity.primary.replace(/^@/, "") || capper.handle;
  const verifiedPct =
    capper.verifiedShare != null && capper.verifiedShare > 0
      ? Math.round(capper.verifiedShare)
      : null;

  return (
    <article className="border-border bg-card border-b">
      {/* Full-bleed cover — breaks out of any ancestor max-width / horizontal pad. */}
      <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2">
        <div className="bg-surface-2 relative h-28 w-full overflow-hidden sm:h-36 lg:h-40">
          {capper.bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capper.bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <div aria-hidden className="scl-glow absolute inset-0 size-full" />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* Only the avatar overlaps the cover; actions sit beside it on larger screens. */}
        <div className="relative z-10 -mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <span className="bg-card ring-card shrink-0 rounded-xl p-1 ring-4">
            <CapperAvatar
              name={avatarName}
              src={capper.avatarUrl}
              size="xl"
              className="size-16 text-base sm:size-20 sm:text-xl"
            />
          </span>

          <div className="flex min-w-0 items-center gap-2 pb-1">
            <SocialLinks socials={capper.socials} />
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
            <RankBadge rank={capper.rank} />
            <span className="leading-tight">
              <span className="text-foreground block text-xs font-semibold tracking-wide uppercase">
                {capper.rank > 0 ? "Rank" : "Standing"}
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                {capper.rank > 0 ? (
                  <>
                    #{capper.rank}
                    {capper.rankDelta ? (
                      <RankMovementIndicator delta={capper.rankDelta} />
                    ) : null}
                  </>
                ) : (
                  BUILDING_RECORD_LABEL
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
                Since {capper.joinedAt.getFullYear()}
              </span>
            </>
          ) : null}
        </div>

        {capper.headline ? (
          <p className="mt-3 max-w-2xl text-sm font-semibold sm:text-base">
            {capper.headline}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {sports.map((sport) => (
            <SportTag key={sport} sport={sport} />
          ))}
          {capper.specialties?.map((specialty) => (
            <span
              key={specialty}
              className="border-border bg-surface-2 text-muted-foreground rounded-lg border px-2 py-1 text-xs font-medium"
            >
              {specialty}
            </span>
          ))}
        </div>

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

function SocialLinks({ socials }: { socials?: CapperSummary["socials"] }) {
  if (!socials) return null;
  type IconType = React.ComponentType<{ className?: string }>;
  const links = [
    socials.twitter && {
      label: "X Profile",
      href: socialProfileUrl("https://x.com", socials.twitter),
      Icon: XIcon as IconType,
    },
    socials.instagram && {
      label: "Instagram Profile",
      href: socialProfileUrl("https://instagram.com", socials.instagram),
      Icon: InstagramIcon as IconType,
    },
    socials.tiktok && {
      label: "TikTok Profile",
      href: socialProfileUrl("https://www.tiktok.com", socials.tiktok),
      Icon: TikTokIcon as IconType,
    },
    socials.website && {
      label: "Website",
      href: socials.website,
      Icon: Globe as IconType,
    },
  ].filter(Boolean) as { label: string; href: string; Icon: IconType }[];

  if (!links.length) return null;

  return (
    <div className="flex items-center gap-1.5">
      {links.map(({ label, href, Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground hover:bg-surface-2 border-border focus-visible:ring-ring flex size-11 items-center justify-center rounded-lg border transition-colors outline-none focus-visible:ring-2 sm:size-10"
        >
          <Icon className="size-4" />
        </a>
      ))}
    </div>
  );
}

/* lucide dropped its brand icons, so platform marks are inline. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.451-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
      className={className}
    >
      <rect x="2" y="2" width="20" height="20" rx="5.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.16 15.3a6.34 6.34 0 0 0 6.33 6.34 6.34 6.34 0 0 0 6.34-6.34V8.75a8.18 8.18 0 0 0 4.76 1.52V6.84a4.85 4.85 0 0 1-1-.15Z" />
    </svg>
  );
}
