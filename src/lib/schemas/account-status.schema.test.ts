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

test("suspension and disable actions require an operational reason", () => {
  assert.equal(
    accountStatusUpdateSchema.safeParse({
      userId: "capper_1",
      status: "SUSPENDED",
      expectedStatus: "ACTIVE",
      reason: "bad",
    }).success,
    false,
  );
  assert.equal(
    accountStatusUpdateSchema.safeParse({
      userId: "capper_1",
      status: "DISABLED",
      expectedStatus: "SUSPENDED",
      reason: "Repeated policy violation",
    }).success,
    true,
  );
});

test("benign lifecycle changes may omit a reason", () => {
  assert.equal(
    accountStatusUpdateSchema.safeParse({
      userId: "capper_1",
      status: "ACTIVE",
      expectedStatus: "PENDING",
    }).success,
    true,
  );
});
