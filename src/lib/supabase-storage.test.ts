import assert from "node:assert/strict";
import test from "node:test";

import { usesSupabasePlatformSecretKey } from "@/lib/supabase-config";

test("platform secret keys are detected for apikey-only storage auth", () => {
  assert.equal(usesSupabasePlatformSecretKey("sb_secret_example"), true);
  assert.equal(
    usesSupabasePlatformSecretKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"),
    false,
  );
});
