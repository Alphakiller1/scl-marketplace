import { Globe } from "lucide-react";

import type { CapperSummary } from "@/lib/mock";
import { CapperAvatar } from "@/components/scl/capper-avatar";
import {
  SportTag,
  TrophyBadge,
  VerificationBadge,
} from "@/components/scl/badges";
import { RankMovementIndicator } from "@/components/scl/indicators";
import { Button } from "@/components/ui/button";

/**
 * The public capper profile hero — identity, rank, specialties, and the
 * trust signals (verification, trophies, socials) above the performance grid.
 */
export function CapperProfileHeader({ capper }: { capper: CapperSummary }) {
  const sports = capper.sports?.length ? capper.sports : [capper.topSport];

  return (
    <div className="scl-glow border-border bg-card relative overflow-hidden rounded-2xl border p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <CapperAvatar name={capper.name} src={capper.avatarUrl} size="xl" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">
                {capper.name}
              </h1>
              {capper.verified ? (
                <VerificationBadge size="md" withLabel />
              ) : null}
            </div>

            <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span>@{capper.handle}</span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <span className="nums text-foreground font-semibold tabular-nums">
                  Rank #{capper.rank}
                </span>
                <RankMovementIndicator delta={capper.rankDelta} />
              </span>
              {capper.joinedAt ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Member since {capper.joinedAt.getFullYear()}</span>
                </>
              ) : null}
            </div>

            {capper.headline ? (
              <p className="mt-2 font-medium">{capper.headline}</p>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {sports.map((s) => (
                <SportTag key={s} sport={s} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SocialLinks socials={capper.socials} />
          <Button render={<a href="#recent-picks" />} size="sm">
            View picks
          </Button>
        </div>
      </div>

      {capper.bio ? (
        <p className="text-muted-foreground mt-5 max-w-2xl text-sm leading-relaxed">
          {capper.bio}
        </p>
      ) : null}

      {capper.trophies.length ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {capper.trophies.map((t) => (
            <TrophyBadge key={t} label={t} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SocialLinks({ socials }: { socials?: CapperSummary["socials"] }) {
  if (!socials) return null;
  type IconType = React.ComponentType<{ className?: string }>;
  const links = [
    socials.twitter && {
      label: "X profile",
      href: `https://x.com/${socials.twitter}`,
      Icon: XIcon as IconType,
    },
    socials.instagram && {
      label: "Instagram profile",
      href: `https://instagram.com/${socials.instagram}`,
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
          className="text-muted-foreground hover:text-foreground hover:bg-surface-2 border-border flex size-9 items-center justify-center rounded-lg border transition-colors"
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
