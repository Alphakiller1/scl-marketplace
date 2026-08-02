import { createHash } from "node:crypto";
import { z } from "zod";

export const CURRENT_POLICY_VERSION = "2026-08-01";
export const CONSENT_TEXT_VERSION = "signup-consent-2026-08-01";

export type RequiredPolicyVersions = {
  termsVersion: string;
  privacyVersion: string;
  responsibleGamingVersion: string;
  refundVersion: string;
};

export function buildPolicyBundleVersion(versions: RequiredPolicyVersions) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(versions))
    .digest("hex")
    .slice(0, 12);

  return `${versions.termsVersion}-bundle-${fingerprint}`;
}

export const legalAcceptanceSchema = z.object({
  confirmEligibility: z.literal(true, {
    error: "Confirm that you meet the age and legal eligibility requirements.",
  }),
  acceptPolicies: z.literal(true, {
    error: "Accept the Terms and acknowledge the Privacy and Refund Policies.",
  }),
  acknowledgeResponsibleGaming: z.literal(true, {
    error: "Acknowledge the Responsible Gaming Policy to continue.",
  }),
});
