export const STOREFRONT_TITLE_MAX_LENGTH = 80;
export const STOREFRONT_DESCRIPTION_MAX_LENGTH = 280;

export type StorefrontIdentity = {
  title: string;
  description: string;
  enabled: boolean;
  customized: boolean;
};

type StorefrontIdentityInput = {
  displayName?: string | null;
  username?: string | null;
  title?: string | null;
  description?: string | null;
  enabled?: boolean;
};

const clean = (value?: string | null) => value?.trim() || null;

export function defaultStorefrontTitle(name: string): string {
  return `${name}${name.toLowerCase().endsWith("s") ? "'" : "'s"} Storefront`;
}

export function resolveStorefrontIdentity({
  displayName,
  username,
  title,
  description,
  enabled = true,
}: StorefrontIdentityInput): StorefrontIdentity {
  const name = clean(displayName) ?? clean(username) ?? "SCL Capper";
  const customTitle = clean(title);
  const customDescription = clean(description);

  return {
    title: customTitle ?? defaultStorefrontTitle(name),
    description:
      customDescription ??
      `Picks and packages selected by ${name} will appear here when they are live.`,
    enabled,
    customized: Boolean(customTitle || customDescription),
  };
}
