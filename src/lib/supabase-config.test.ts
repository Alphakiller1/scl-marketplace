import assert from "node:assert/strict";
import test from "node:test";

import {
  ensureSupabaseDatabaseEnvAliases,
  supabaseIntegrationStatus,
  supabaseProjectUrl,
  supabaseServiceRoleKey,
  supabaseStorageConfigured,
} from "@/lib/supabase-config";

const ORIGINAL = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL)) delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL);
}

test("supabaseProjectUrl accepts NEXT_PUBLIC_SUPABASE_URL", () => {
  restoreEnv();
  delete process.env.SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  assert.equal(supabaseProjectUrl(), "https://abc.supabase.co");
});

test("supabaseServiceRoleKey accepts SUPABASE_SECRET_KEY from Vercel integration", () => {
  restoreEnv();
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SECRET_KEY = "secret-from-vercel";
  assert.equal(supabaseServiceRoleKey(), "secret-from-vercel");
  assert.equal(supabaseStorageConfigured(), false);
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  assert.equal(supabaseStorageConfigured(), true);
});

test("ensureSupabaseDatabaseEnvAliases maps POSTGRES vars with schema=scl", () => {
  restoreEnv();
  delete process.env.DATABASE_URL;
  delete process.env.DIRECT_URL;
  process.env.POSTGRES_PRISMA_URL =
    "postgresql://user:pass@host:6543/postgres?pgbouncer=true";
  process.env.POSTGRES_URL_NON_POOLING =
    "postgresql://user:pass@host:5432/postgres";

  ensureSupabaseDatabaseEnvAliases();

  assert.match(process.env.DATABASE_URL ?? "", /schema=scl/);
  assert.match(process.env.DIRECT_URL ?? "", /schema=scl/);
});

test("supabaseIntegrationStatus reports storage readiness", () => {
  restoreEnv();
  process.env.SUPABASE_URL = "https://abc.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  assert.deepEqual(supabaseIntegrationStatus(), {
    storage: true,
    url: true,
    serviceRole: true,
    bucket: "scl-profile-media",
  });
});
