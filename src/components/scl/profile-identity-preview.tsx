import { AtSign } from "lucide-react";

import { CapperAvatar } from "@/components/scl/capper-avatar";
import { SportTag, VerificationBadge } from "@/components/scl/badges";

export type ProfileIdentityPreviewData = {
  displayName: string;
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

      <div className="bg-surface-2 relative h-24 overflow-hidden">
        {profile.bannerUrl ? (
          // Stored profile media is rendered directly so imported and Supabase URLs both work.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.bannerUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div aria-hidden className="scl-glow absolute inset-0" />
        )}
      </div>

      <div className="px-4 pb-4">
        <div className="-mt-7 flex items-end justify-between gap-3">
          <span className="bg-card rounded-xl p-1">
            <CapperAvatar
              name={profile.displayName || profile.username}
              src={profile.avatarUrl ?? undefined}
              size="xl"
            />
          </span>
          {profile.verified ? <VerificationBadge size="sm" withLabel /> : null}
        </div>

        <h3 className="mt-3 truncate text-lg font-bold">
          {profile.displayName || profile.username}
        </h3>
        <p className="text-muted-foreground flex items-center text-sm">
          <AtSign className="size-3.5" aria-hidden />
          {profile.username}
        </p>

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
