import assert from "node:assert/strict";
import test from "node:test";

import {
  calcAffiliateCents,
  defaultPathForRole,
  resolveAffiliatePercent,
} from "@/lib/commerce-settings";
import {
  CAPPER_EMAIL_AUDIENCES,
  CUSTOMER_EMAIL_AUDIENCES,
} from "@/lib/schemas/admin-communications.schema";
import { isCapperAudience, isCustomerAudience } from "@/lib/bulk-email";

test("defaultPathForRole routes by account type", () => {
  assert.equal(defaultPathForRole("ADMIN"), "/admin");
  assert.equal(defaultPathForRole("CUSTOMER"), "/account");
  assert.equal(defaultPathForRole("CAPPER"), "/dashboard");
  assert.equal(defaultPathForRole(undefined), "/dashboard");
});

test("resolveAffiliatePercent prefers package then capper then platform", () => {
  assert.equal(
    resolveAffiliatePercent({
      packagePercent: 30,
      capperPercent: 25,
      platformPercent: 20,
    }),
    30,
  );
  assert.equal(
    resolveAffiliatePercent({
      packagePercent: null,
      capperPercent: 25,
      platformPercent: 20,
    }),
    25,
  );
  assert.equal(
    resolveAffiliatePercent({
      packagePercent: null,
      capperPercent: null,
      platformPercent: 18,
    }),
    18,
  );
  assert.equal(resolveAffiliatePercent({}), 20);
});

test("calcAffiliateCents rounds to nearest cent", () => {
  assert.equal(calcAffiliateCents(2999, 20), 600);
  assert.equal(calcAffiliateCents(5000, 15), 750);
});

test("bulk email audience helpers stay disjoint", () => {
  for (const audience of CAPPER_EMAIL_AUDIENCES) {
    assert.equal(isCapperAudience(audience), true);
    assert.equal(isCustomerAudience(audience), false);
  }
  for (const audience of CUSTOMER_EMAIL_AUDIENCES) {
    assert.equal(isCustomerAudience(audience), true);
    assert.equal(isCapperAudience(audience), false);
  }
});
