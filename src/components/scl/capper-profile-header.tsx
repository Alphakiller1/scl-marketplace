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
import { RankBadge } from "@/components/scl/rank-badge";
import { Button } from "@/components/ui/button";
import { socialProfileUrl } from "@/lib/urls";

/**
 * The public capper profile hero — identity, rank, specialties, and the
 * trust signals (verification, trophies, socials) above the performance grid.
 */
export function CapperProfileHeader({ capper }: { capper: CapperSummary }) {
  const sports = capper.sports?.length ? capper.sports : [capper.topSport];

  return (
    <article className="border-border bg-card overflow-hidden rounded-xl border">
      <div className="bg-surface-2 relative h-24 overflow-hidden sm:h-36">
        {capper.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={capper.bannerUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div aria-hidden className="scl-glow absolute inset-0" />
        )}
      </div>

      <div className="px-4 pb-4 sm:px-7 sm:pb-7">
        <div className="-mt-7 flex flex-col gap-4 sm:-mt-10 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-end gap-3 sm:gap-4">
            <span className="bg-card rounded-xl p-1">
              <CapperAvatar
                name={capper.name}
                src={capper.avatarUrl}
                size="xl"
                className="size-16 text-base sm:size-20 sm:text-xl"
              />
            </span>
            <div className="min-w-0 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="max-w-full truncate text-xl font-bold sm:text-2xl">
                  {capper.name}
                </h1>
                {capper.verified ? (
                  <VerificationBadge size="md" withLabel />
                ) : null}
                {capper.isLegacy ? <LegacyBadge /> : null}
              </div>
              <span className="text-muted-foreground text-sm">
                @{capper.handle}
              </span>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
            <SocialLinks socials={capper.socials} />
            <Button
              render={<a href="#recent-picks" />}
              nativeButton={false}
              className="min-h-11 flex-1 sm:min-h-10 sm:flex-none"
            >
              View Picks
            </Button>
          </div>
        </div>

        <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-2">
            <RankBadge rank={capper.rank} />
            <span>
              <span className="text-foreground block font-semibold">
                Public Rank
              </span>
              <span className="inline-flex items-center gap-1 text-xs">
                #{capper.rank}
                {capper.rankDelta ? (
                  <RankMovementIndicator delta={capper.rankDelta} />
                ) : null}
              </span>
            </span>
          </span>
          {capper.joinedAt ? (
            <>
              <span className="border-border h-8 border-l" aria-hidden />
              <span>Member Since {capper.joinedAt.getFullYear()}</span>
            </>
          ) : null}
        </div>

        {capper.headline ? (
          <p className="mt-3 max-w-2xl text-base font-semibold">
            {capper.headline}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-1.5">
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
          <p className="text-muted-foreground mt-5 max-w-2xl text-sm leading-relaxed">
            {capper.bio}
          </p>
        ) : null}

        {capper.trophies.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {capper.trophies.map((trophy) => (
              <TrophyBadge key={trophy} label={trophy} />
            ))}
          </div>
        ) : null}
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

/* lucide dropped its brand icons, so the X/Instagram marks are inline. */
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
