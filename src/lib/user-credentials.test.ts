import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLegacyPlusAddressEmail,
  emailsShareInbox,
} from "@/lib/user-credentials";

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

test("emailsShareInbox treats plus-addressed legacy imports as the same inbox", () => {
  assert.equal(
    emailsShareInbox("Agency@Example.com", "agency+mtndegen@example.com"),
    true,
  );
  assert.equal(emailsShareInbox("one@example.com", "two@example.com"), false);
});
