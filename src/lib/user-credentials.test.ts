import assert from "node:assert/strict";
import test from "node:test";

import { buildLegacyPlusAddressEmail } from "@/lib/user-credentials";

test("buildLegacyPlusAddressEmail maps a bare inbox to the legacy plus variant", () => {
  assert.equal(
    buildLegacyPlusAddressEmail("agency@example.com", "capper_two"),
    "agency+capper_two@example.com",
  );
});

test("buildLegacyPlusAddressEmail normalizes casing and whitespace", () => {
  assert.equal(
    buildLegacyPlusAddressEmail("  Agency@Example.COM ", "Capper_Two"),
    "agency+capper_two@example.com",
  );
});

test("buildLegacyPlusAddressEmail leaves already plus-addressed emails alone", () => {
  assert.equal(
    buildLegacyPlusAddressEmail("agency+capper_two@example.com", "capper_two"),
    null,
  );
});

test("buildLegacyPlusAddressEmail rejects malformed addresses", () => {
  assert.equal(buildLegacyPlusAddressEmail("not-an-email", "capper"), null);
  assert.equal(buildLegacyPlusAddressEmail("@example.com", "capper"), null);
  assert.equal(buildLegacyPlusAddressEmail("user@", "capper"), null);
});
