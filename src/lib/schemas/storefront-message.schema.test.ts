import assert from "node:assert/strict";
import test from "node:test";

import { sendStorefrontMessageSchema } from "@/lib/schemas/storefront-message.schema";

test("storefront message requires non-empty body", () => {
  assert.equal(
    sendStorefrontMessageSchema.safeParse({
      storeConnectionId: "conn_1",
      body: "",
    }).success,
    false,
  );
  assert.equal(
    sendStorefrontMessageSchema.safeParse({
      storeConnectionId: "conn_1",
      body: "Please confirm the affiliate invite was sent.",
    }).success,
    true,
  );
});
