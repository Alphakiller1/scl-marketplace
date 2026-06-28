export type ProfileCompletionInput = {
  displayName?: string | null;
  avatarUrl?: string | null;
  headline?: string | null;
  bio?: string | null;
  sports?: string[];
  specialties?: string[];
  instagram?: string | null;
  twitter?: string | null;
  facebook?: string | null;
  tiktok?: string | null;
  website?: string | null;
};

export type ProfileCompletionItem = {
  id:
    | "identity"
    | "photo"
    | "headline"
    | "bio"
    | "sports"
    | "specialties"
    | "links";
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

export function calculateProfileCompletion(
  profile: ProfileCompletionInput,
): ProfileCompletion {
  const items: ProfileCompletionItem[] = [
    {
      id: "identity",
      label: "Display name",
      complete: hasText(profile.displayName, 2),
    },
    {
      id: "photo",
      label: "Profile image",
      complete: hasText(profile.avatarUrl),
    },
    {
      id: "headline",
      label: "Capper headline",
      complete: hasText(profile.headline, 12),
    },
    {
      id: "bio",
      label: "About section",
      complete: hasText(profile.bio, 80),
    },
    {
      id: "sports",
      label: "Sports coverage",
      complete: Boolean(profile.sports?.length),
    },
    {
      id: "specialties",
      label: "Betting specialties",
      complete: Boolean(profile.specialties?.length),
    },
    {
      id: "links",
      label: "Public link",
      complete: [
        profile.instagram,
        profile.twitter,
        profile.facebook,
        profile.tiktok,
        profile.website,
      ].some((value) => hasText(value)),
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
