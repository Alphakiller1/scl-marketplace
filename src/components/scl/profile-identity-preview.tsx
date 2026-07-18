import { CapperAvatar } from "@/components/scl/capper-avatar";

import { CapperBanner } from "@/components/scl/capper-banner";

import { SportTag, VerificationBadge } from "@/components/scl/badges";

import { identityDisplayLines } from "@/lib/identity";

export type ProfileIdentityPreviewData = {
  username: string;

  headline?: string;

  avatarUrl?: string | null;

  bannerUrl?: string | null;

  sports: string[];

  verified: boolean;
};

export function ProfileIdentityPreview({
  profile,
}: {
  profile: ProfileIdentityPreviewData;
}) {
  const identity = identityDisplayLines({
    handle: profile.username,
  });

  const avatarName =
    identity.primary.replace(/^@/, "") || profile.username || "scl";

  return (
    <section
      aria-labelledby="profile-preview-title"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <div className="border-border flex items-center justify-between border-b px-4 py-3">
        <h2
          id="profile-preview-title"
          className="text-sm font-semibold tracking-wide"
        >
          Public Identity Preview
        </h2>

        <span className="text-muted-foreground text-xs">Live</span>
      </div>

      <CapperBanner
        src={profile.bannerUrl}
        heightClass="h-24 w-full"
        collapseWhenEmpty
      />

      <div className="px-4 pb-4">
        <div className="relative z-10 flex items-end justify-between gap-3 pt-3">
          <span className="bg-card ring-border rounded-xl p-1 ring-1">
            <CapperAvatar
              name={avatarName}
              src={profile.avatarUrl ?? undefined}
              size="md"
            />
          </span>

          {profile.verified ? <VerificationBadge size="sm" withLabel /> : null}
        </div>

        <h3 className="mt-3 text-lg font-bold break-words">
          {identity.primary}
        </h3>

        {identity.secondary ? (
          <p className="text-muted-foreground text-sm break-all">
            {identity.secondary}
          </p>
        ) : null}

        <p className="mt-3 min-h-10 text-sm font-medium">
          {profile.headline?.trim() || "Your Capper Headline"}
        </p>

        <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
          {profile.sports.length ? (
            profile.sports

              .slice(0, 4)

              .map((sport) => <SportTag key={sport} sport={sport} />)
          ) : (
            <span className="text-muted-foreground text-xs">
              Sports Coverage Appears Here
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
