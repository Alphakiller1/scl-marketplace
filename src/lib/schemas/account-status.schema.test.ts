import assert from "node:assert/strict";
import test from "node:test";

import { accountStatusUpdateSchema } from "@/lib/schemas/account-status.schema";

test("account status updates accept only known lifecycle states", () => {
  assert.equal(
    accountStatusUpdateSchema.safeParse({
      userId: "capper_1",
      status: "SUSPENDED",
      reason: "Manual review",
    }).success,
    true,
  );
  assert.equal(
    accountStatusUpdateSchema.safeParse({
      userId: "capper_1",
      status: "BLOCKED",
    }).success,
    false,
  );
});
