export const POLICY_SLUGS = [
  "TERMS",
  "PRIVACY",
  "DISCLAIMER",
  "RESPONSIBLE_GAMING",
  "REFUND",
] as const;

export type PolicySlugKey = (typeof POLICY_SLUGS)[number];

export const POLICY_METADATA: Record<
  PolicySlugKey,
  { label: string; path: string; defaultTitle: string }
> = {
  TERMS: {
    label: "Terms of Service",
    path: "/terms",
    defaultTitle: "Terms of Service",
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
  REFUND: {
    label: "Refund Policy",
    path: "/refund-policy",
    defaultTitle: "Refund Policy",
  },
};

export const REQUIRED_ACCEPTANCE_POLICY_SLUGS = [
  "TERMS",
  "PRIVACY",
  "RESPONSIBLE_GAMING",
  "REFUND",
] as const satisfies readonly PolicySlugKey[];

export type RequiredAcceptancePolicySlug =
  (typeof REQUIRED_ACCEPTANCE_POLICY_SLUGS)[number];

export function requiresPolicyAcceptance(
  slug: PolicySlugKey,
): slug is RequiredAcceptancePolicySlug {
  return REQUIRED_ACCEPTANCE_POLICY_SLUGS.includes(
    slug as RequiredAcceptancePolicySlug,
  );
}

export function parsePolicySlug(
  value: string | string[] | null | undefined,
): PolicySlugKey {
  const candidate = Array.isArray(value) ? value[0] : value;
  return POLICY_SLUGS.includes(candidate as PolicySlugKey)
    ? (candidate as PolicySlugKey)
    : "TERMS";
}
