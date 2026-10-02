import assert from "node:assert/strict";
import test from "node:test";

import { normalizeBrevoMessageId } from "./brevo-message-id";

test("removes the angle brackets returned by the Brevo send API", () => {
  assert.equal(
    normalizeBrevoMessageId("<201798300811.5787683@relay.domain.com>"),
    "201798300811.5787683@relay.domain.com",
  );
});

test("keeps the unwrapped message id used by Brevo webhooks", () => {
  assert.equal(
    normalizeBrevoMessageId("201798300811.5787683@relay.domain.com"),
    "201798300811.5787683@relay.domain.com",
  );
});

test("trims message id whitespace", () => {
  assert.equal(normalizeBrevoMessageId("  <message-id>  "), "message-id");
});
