export type ProfileCompletionInput = {
  /** @deprecated Ignored — username is the identity; not a completion criterion. */
  displayName?: string | null;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  sports?: string[];
  specialties?: string[];
  betTypes?: string[];
  providerType?: string | null;
  dailyVolume?: string | null;
  /** @deprecated External links are no longer collected — ignored. */
  instagram?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
};

export type ProfileCompletionItem = {
  id:
    | "photo"
    | "cover"
    | "headline"
    | "bio"
    | "sports"
    | "specialties"
    | "approach";
  label: string;
  complete: boolean;
};

export type ProfileCompletion = {
  completed: number;
  total: number;
  percentage: number;
  isComplete: boolean;
  items: ProfileCompletionItem[];
};

const hasText = (value?: string | null, min = 1) =>
  Boolean(value && value.trim().length >= min);

/**
 * Profile strength — only still-collectable fields after username-only identity
 * and the removal of external links.
 *
 * Counted: avatar, cover, headline, bio, sports, specialties, approach
 * (provider type + bet types and/or daily volume).
 * Not counted: displayName, social/website links (dormant).
 */
export function calculateProfileCompletion(
  profile: ProfileCompletionInput,
): ProfileCompletion {
  const hasVolume =
    typeof profile.dailyVolume === "string" &&
    profile.dailyVolume.trim().length > 0;
  const approachComplete =
    Boolean(profile.providerType) &&
    (Boolean(profile.betTypes?.length) || hasVolume);

  const items: ProfileCompletionItem[] = [
    {
      id: "photo",
      label: "Profile Image",
      complete: hasText(profile.avatarUrl),
    },
    {
      id: "cover",
      label: "Cover Image",
      complete: hasText(profile.bannerUrl),
    },
    {
      id: "headline",
      label: "Capper Headline",
      complete: hasText(profile.headline, 12),
    },
    {
      id: "bio",
      label: "About Section",
      complete: hasText(profile.bio),
    },
    {
      id: "sports",
      label: "Sports Coverage",
      complete: Boolean(profile.sports?.length),
    },
    {
      id: "specialties",
      label: "Betting Specialties",
      complete: Boolean(profile.specialties?.length),
    },
    {
      id: "approach",
      label: "Offering And Bet Types",
      complete: approachComplete,
    },
  ];

  const completed = items.filter((item) => item.complete).length;
  const percentage = Math.round((completed / items.length) * 100);

  return {
    completed,
    total: items.length,
    percentage,
    isComplete: completed === items.length,
    items,
  };
}
