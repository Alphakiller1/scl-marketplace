/**
 * Verification-tier presentation + math (pick integrity, see docs/SCL_PICK_INTEGRITY.md).
 *
 * The tier is the single public trust signal on a pick: it's computed from facts at submission
 * (timing, event binding, odds check) and never self-asserted. This module is the one place the
 * UI reads tier labels/copy/tone from, plus the helper that rolls picks up into a per-capper
 * "verified share." Pure + client-safe (no `server-only`, no Prisma value import).
 */

/** Mirrors the Prisma `VerificationTier` enum. */
export type VerificationTier = "AUTO_VERIFIED" | "VERIFIED" | "SELF_REPORTED";

export type VerificationTierMeta = {
  /** Full label, e.g. for tooltips/legends. */
  label: string;
  /** Compact badge text. */
  short: string;
  /** One-line explanation of what the tier means. */
  description: string;
  /** Visual weight: a real trust signal vs. a neutral "counts, but unverified" marker. */
  tone: "verified" | "muted";
};

export const VERIFICATION_TIER_META: Record<
  VerificationTier,
  VerificationTierMeta
> = {
  AUTO_VERIFIED: {
    label: "Auto-verified",
    short: "Verified",
    description:
      "Captured automatically from an authorized source, logged pre-game, with odds checked against the market.",
    tone: "verified",
  },
  VERIFIED: {
    label: "Verified",
    short: "Verified",
    description:
      "Logged pre-game against a real event, with the claimed odds checked against the live market.",
    tone: "verified",
  },
  SELF_REPORTED: {
    label: "Self-reported",
    short: "Self-reported",
    description:
      "Entered manually and not matched to a live market — it counts on the profile but not toward the verified record.",
    tone: "muted",
  },
};

export function verificationTierMeta(
  tier: VerificationTier,
): VerificationTierMeta {
  return VERIFICATION_TIER_META[tier] ?? VERIFICATION_TIER_META.SELF_REPORTED;
}

/** AUTO_VERIFIED and VERIFIED both clear the trust bar; SELF_REPORTED does not. */
export function isVerifiedTier(tier: VerificationTier): boolean {
  return tier === "VERIFIED" || tier === "AUTO_VERIFIED";
}

/** Share (0–100) of the given picks that carry a verified tier; 0 for an empty list. */
export function computeVerifiedShare(tiers: VerificationTier[]): number {
  if (tiers.length === 0) return 0;
  const verified = tiers.filter(isVerifiedTier).length;
  return (verified / tiers.length) * 100;
}
