import assert from "node:assert/strict";
import test from "node:test";

import { SCL_BRAND_NAME, SCL_TITLE } from "@/lib/brand";

test("public brand identity uses the owner-approved plural cappers name", () => {
  assert.equal(SCL_BRAND_NAME, "Sports Cappers Leaderboard");
  assert.equal(SCL_TITLE, "SCL — Sports Cappers Leaderboard");
});
