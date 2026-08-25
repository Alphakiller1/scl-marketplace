import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasRequiredWhopAppPermission,
  mergeRequiredWhopAppPermission,
  WHOP_PLAN_READ_PERMISSION,
} from "@/lib/whop-app-permissions";

const existing = [
  {
    is_required: true,
    justification: "Keep product presentation synchronized.",
    permission_action: {
      action: "product:basic:read",
      name: "Read products",
    },
  },
];

test("adds plan read as required without removing existing app permissions", () => {
  const merged = mergeRequiredWhopAppPermission(existing);

  assert.deepEqual(
    merged.map((permission) => permission.action),
    ["product:basic:read", WHOP_PLAN_READ_PERMISSION],
  );
  assert.equal(merged[0]?.justification, existing[0]?.justification);
  assert.equal(merged[1]?.is_required, true);
});

test("upgrades an optional plan permission to required", () => {
  const merged = mergeRequiredWhopAppPermission([
    {
      is_required: false,
      justification: "Read package prices.",
      permission_action: {
        action: WHOP_PLAN_READ_PERMISSION,
        name: "Read plans",
      },
    },
  ]);

  assert.equal(merged.length, 1);
  assert.equal(merged[0]?.is_required, true);
  assert.equal(merged[0]?.justification, "Read package prices.");
  assert.equal(
    hasRequiredWhopAppPermission([
      {
        is_required: true,
        permission_action: { action: WHOP_PLAN_READ_PERMISSION },
      },
    ]),
    true,
  );
});
