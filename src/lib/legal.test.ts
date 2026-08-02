import assert from "node:assert/strict";
import test from "node:test";

import { buildPolicyBundleVersion, legalAcceptanceSchema } from "@/lib/legal";

const VERSIONS = {
  termsVersion: "2026-08-01",
  privacyVersion: "2026-08-01",
  responsibleGamingVersion: "2026-08-01",
  refundVersion: "2026-08-01",
};

test("policy bundle version is stable and changes with any required policy", () => {
  const first = buildPolicyBundleVersion(VERSIONS);
  assert.equal(buildPolicyBundleVersion({ ...VERSIONS }), first);
  assert.notEqual(
    buildPolicyBundleVersion({ ...VERSIONS, refundVersion: "2026-08-02" }),
    first,
  );
});

test("legal re-consent requires all three explicit acknowledgements", () => {
  const accepted = {
    confirmEligibility: true,
    acceptPolicies: true,
    acknowledgeResponsibleGaming: true,
  } as const;
  assert.equal(legalAcceptanceSchema.safeParse(accepted).success, true);

  for (const field of Object.keys(accepted) as Array<keyof typeof accepted>) {
    assert.equal(
      legalAcceptanceSchema.safeParse({ ...accepted, [field]: false }).success,
      false,
    );
  }
});
