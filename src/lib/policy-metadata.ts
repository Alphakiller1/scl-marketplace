export const POLICY_SLUGS = [
  "TERMS",
  "PRIVACY",
  "DISCLAIMER",
  "RESPONSIBLE_GAMING",
] as const;

export type PolicySlugKey = (typeof POLICY_SLUGS)[number];

export const POLICY_METADATA: Record<
  PolicySlugKey,
  { label: string; path: string; defaultTitle: string }
> = {
  TERMS: {
    label: "Terms & Conditions",
    path: "/terms",
    defaultTitle: "Terms & Conditions",
  },
  PRIVACY: {
    label: "Privacy Policy",
    path: "/privacy",
    defaultTitle: "Privacy Policy",
  },
  DISCLAIMER: {
    label: "Disclaimer",
    path: "/disclaimer",
    defaultTitle: "Disclaimer",
  },
  RESPONSIBLE_GAMING: {
    label: "Responsible Gaming",
    path: "/responsible-gaming",
    defaultTitle: "Responsible Gaming",
  },
};

export function parsePolicySlug(
  value: string | string[] | null | undefined,
): PolicySlugKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return POLICY_SLUGS.includes(candidate as PolicySlugKey)
    ? (candidate as PolicySlugKey)
    : "TERMS";
}
